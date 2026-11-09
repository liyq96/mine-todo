package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

const trashRetentionDays = 30

func purgeExpiredTrash(db *sql.DB, cutoff time.Time) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin purge expired trash tx: %w", err)
	}
	statements := []struct {
		query string
		name  string
	}{
		{`DELETE FROM todo_subitems WHERE todo_id IN (SELECT id FROM todos WHERE is_trashed = 1 AND trashed_at < ?)`, "expired todo subitems"},
		{`DELETE FROM todo_note_links WHERE todo_id IN (SELECT id FROM todos WHERE is_trashed = 1 AND trashed_at < ?)`, "expired todo links"},
		{`DELETE FROM todos WHERE is_trashed = 1 AND trashed_at < ?`, "expired todos"},
		{`DELETE FROM todo_note_links WHERE note_id IN (SELECT id FROM notes WHERE is_trashed = 1 AND trashed_at < ?)`, "expired note links"},
		{`DELETE FROM notes WHERE is_trashed = 1 AND trashed_at < ?`, "expired notes"},
		{`DELETE FROM todo_groups WHERE id <> 'default' AND is_trashed = 1 AND trashed_at < ?`, "expired groups"},
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement.query, cutoff); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("purge %s: %w", statement.name, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit purge expired trash: %w", err)
	}
	return nil
}

func (m *Manager) RestoreTodo(id string) error {
	var groupID string
	if err := m.db.QueryRow(`SELECT group_id FROM todos WHERE id = ? AND is_trashed = 1`, id).Scan(&groupID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("trashed todo not found")
		}
		return fmt.Errorf("query trashed todo: %w", err)
	}
	var groupTrashed bool
	if err := m.db.QueryRow(`SELECT is_trashed FROM todo_groups WHERE id = ?`, groupID).Scan(&groupTrashed); err != nil || groupTrashed {
		groupID = defaultGroupID
	}
	result, err := m.db.Exec(`
		UPDATE todos SET group_id = ?, is_trashed = 0, trashed_at = NULL, trash_batch_id = NULL, updated_at = ?
		WHERE id = ? AND is_trashed = 1
	`, groupID, time.Now(), id)
	if err != nil {
		return fmt.Errorf("restore todo: %w", err)
	}
	return requireAffected(result, "trashed todo not found")
}

func (m *Manager) RestoreNote(id string) error {
	result, err := m.db.Exec(`
		UPDATE notes SET is_trashed = 0, trashed_at = NULL, updated_at = ?
		WHERE id = ? AND is_trashed = 1
	`, time.Now(), id)
	if err != nil {
		return fmt.Errorf("restore note: %w", err)
	}
	return requireAffected(result, "trashed note not found")
}

func (m *Manager) RestoreGroup(id string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin restore group tx: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		UPDATE todos SET is_trashed = 0, trashed_at = NULL, trash_batch_id = NULL, updated_at = ?
		WHERE group_id = ? AND is_trashed = 1 AND trash_batch_id = (
			SELECT trash_batch_id FROM todo_groups WHERE id = ? AND is_trashed = 1
		)
	`, time.Now(), id, id); err != nil {
		return fmt.Errorf("restore group todos tx: %w", err)
	}
	result, err := tx.Exec(`
		UPDATE todo_groups SET is_trashed = 0, trashed_at = NULL, trash_batch_id = NULL, updated_at = ?
		WHERE id = ? AND is_trashed = 1
	`, time.Now(), id)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("restore group: %w", err)
	}
	if err := requireAffected(result, "trashed group not found"); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit restore group: %w", err)
	}
	return nil
}

func (m *Manager) PurgeTodo(id string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin purge todo tx: %w", err)
	}
	if err := purgeTodoTx(tx, id); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit purge todo: %w", err)
	}
	return nil
}

func (m *Manager) PurgeTrash() error {
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin purge trash tx: %w", err)
	}
	defer tx.Rollback()

	statements := []struct {
		query string
		label string
	}{
		{`DELETE FROM todo_subitems WHERE todo_id IN (SELECT id FROM todos WHERE is_trashed = 1)`, "todo subitems"},
		{`DELETE FROM todo_note_links WHERE todo_id IN (SELECT id FROM todos WHERE is_trashed = 1) OR note_id IN (SELECT id FROM notes WHERE is_trashed = 1)`, "note links"},
		{`DELETE FROM todos WHERE is_trashed = 1`, "todos"},
		{`DELETE FROM notes WHERE is_trashed = 1`, "notes"},
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement.query); err != nil {
			return fmt.Errorf("purge trash %s tx: %w", statement.label, err)
		}
	}
	if _, err := tx.Exec(`
		UPDATE todos SET group_id = ?, updated_at = ?
		WHERE is_trashed = 0 AND group_id IN (SELECT id FROM todo_groups WHERE is_trashed = 1 AND id <> ?)
	`, defaultGroupID, time.Now(), defaultGroupID); err != nil {
		return fmt.Errorf("reassign active trash group todos tx: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM todo_groups WHERE is_trashed = 1 AND id <> ?`, defaultGroupID); err != nil {
		return fmt.Errorf("purge trash groups tx: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit purge trash tx: %w", err)
	}
	return nil
}

func (m *Manager) PurgeNote(id string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin purge note tx: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM todo_note_links WHERE note_id = ?`, id); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("purge note links: %w", err)
	}
	result, err := tx.Exec(`DELETE FROM notes WHERE id = ? AND is_trashed = 1`, id)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("purge note: %w", err)
	}
	if err := requireAffected(result, "trashed note not found"); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit purge note: %w", err)
	}
	return nil
}

func (m *Manager) PurgeGroup(id string) error {
	if id == defaultGroupID {
		return errors.New("default group cannot be purged")
	}
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin purge group tx: %w", err)
	}
	rows, err := tx.Query(`SELECT id FROM todos WHERE group_id = ? AND is_trashed = 1`, id)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("query trashed group todos: %w", err)
	}
	ids := make([]string, 0)
	for rows.Next() {
		var todoID string
		if err := rows.Scan(&todoID); err != nil {
			_ = rows.Close()
			_ = tx.Rollback()
			return fmt.Errorf("scan trashed group todo: %w", err)
		}
		ids = append(ids, todoID)
	}
	_ = rows.Close()
	for _, todoID := range ids {
		if err := purgeTodoTx(tx, todoID); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	result, err := tx.Exec(`DELETE FROM todo_groups WHERE id = ? AND is_trashed = 1`, id)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("purge group: %w", err)
	}
	if err := requireAffected(result, "trashed group not found"); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit purge group: %w", err)
	}
	return nil
}

func purgeTodoTx(tx *sql.Tx, id string) error {
	if _, err := tx.Exec(`DELETE FROM todo_subitems WHERE todo_id = ?`, id); err != nil {
		return fmt.Errorf("purge todo subitems: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM todo_note_links WHERE todo_id = ?`, id); err != nil {
		return fmt.Errorf("purge todo links: %w", err)
	}
	result, err := tx.Exec(`DELETE FROM todos WHERE id = ? AND is_trashed = 1`, id)
	if err != nil {
		return fmt.Errorf("purge todo: %w", err)
	}
	return requireAffected(result, "trashed todo not found")
}

func requireAffected(result sql.Result, notFound string) error {
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New(notFound)
	}
	return nil
}

func replaceTodoNoteLinks(tx *sql.Tx, todoID string, noteIDs []string) error {
	if _, err := tx.Exec(`DELETE FROM todo_note_links WHERE todo_id = ? AND note_id IN (SELECT id FROM notes WHERE is_trashed = 0)`, todoID); err != nil {
		return fmt.Errorf("clear todo note links: %w", err)
	}
	for _, noteID := range normalizeStringList(noteIDs) {
		if _, err := tx.Exec(`
			INSERT INTO todo_note_links (todo_id, note_id, created_at)
			SELECT ?, id, ? FROM notes WHERE id = ? AND is_trashed = 0
			ON CONFLICT(todo_id, note_id) DO NOTHING
		`, todoID, time.Now(), noteID); err != nil {
			return fmt.Errorf("insert todo note link: %w", err)
		}
	}
	return nil
}

func replaceNoteTodoLinks(tx *sql.Tx, noteID string, todoIDs []string) error {
	if _, err := tx.Exec(`DELETE FROM todo_note_links WHERE note_id = ? AND todo_id IN (SELECT id FROM todos WHERE is_trashed = 0)`, noteID); err != nil {
		return fmt.Errorf("clear note todo links: %w", err)
	}
	for _, todoID := range normalizeStringList(todoIDs) {
		if _, err := tx.Exec(`
			INSERT INTO todo_note_links (todo_id, note_id, created_at)
			SELECT id, ?, ? FROM todos WHERE id = ? AND is_trashed = 0
			ON CONFLICT(todo_id, note_id) DO NOTHING
		`, noteID, time.Now(), todoID); err != nil {
			return fmt.Errorf("insert note todo link: %w", err)
		}
	}
	return nil
}

func (m *Manager) loadTodoNoteIDs(todo *Todo) error {
	rows, err := m.db.Query(`SELECT l.note_id FROM todo_note_links l JOIN notes n ON n.id = l.note_id WHERE l.todo_id = ? AND n.is_trashed = 0 ORDER BY l.created_at`, todo.ID)
	if err != nil {
		return fmt.Errorf("query todo note links: %w", err)
	}
	defer rows.Close()
	todo.NoteIDs = make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("scan todo note link: %w", err)
		}
		todo.NoteIDs = append(todo.NoteIDs, id)
	}
	return rows.Err()
}

func (m *Manager) loadNoteTodoIDs(note *Note) error {
	rows, err := m.db.Query(`SELECT l.todo_id FROM todo_note_links l JOIN todos t ON t.id = l.todo_id WHERE l.note_id = ? AND t.is_trashed = 0 ORDER BY l.created_at`, note.ID)
	if err != nil {
		return fmt.Errorf("query note todo links: %w", err)
	}
	defer rows.Close()
	note.TodoIDs = make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("scan note todo link: %w", err)
		}
		note.TodoIDs = append(note.TodoIDs, id)
	}
	return rows.Err()
}

func encodeStringList(values []string) string {
	normalized := normalizeStringList(values)
	data, err := json.Marshal(normalized)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func decodeStringList(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}
	var values []string
	if err := json.Unmarshal([]byte(value), &values); err != nil {
		return []string{}
	}
	return normalizeStringList(values)
}

func normalizeStringList(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(strings.TrimPrefix(value, "#"))
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
	}
	sort.SliceStable(result, func(i, j int) bool {
		return strings.ToLower(result[i]) < strings.ToLower(result[j])
	})
	return result
}

func normalizePriority(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "q1", "high":
		return "q1"
	case "q2", "medium":
		return "q2"
	case "q3":
		return "q3"
	case "q4", "normal":
		return "q4"
	default:
		return "q4"
	}
}
