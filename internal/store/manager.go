package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"mine-todo/internal/config"
)

type Manager struct {
	db  *sql.DB
	cfg *config.AppConfig
}

type Todo struct {
	ID             string     `json:"id"`
	GroupID        string     `json:"groupId"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary"`
	DetailMarkdown string     `json:"detailMarkdown"`
	IsCompleted    bool       `json:"isCompleted"`
	DueDate        string     `json:"dueDate"`
	Priority       string     `json:"priority"`
	ReminderAt     string     `json:"reminderAt"`
	Tags           []string   `json:"tags"`
	NoteIDs        []string   `json:"noteIds"`
	IsFavorite     bool       `json:"isFavorite"`
	IsArchived     bool       `json:"isArchived"`
	IsTrashed      bool       `json:"isTrashed"`
	TrashedAt      *time.Time `json:"trashedAt"`
	Subitems       []Subitem  `json:"subitems"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type Group struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	IsTrashed bool       `json:"isTrashed"`
	TrashedAt *time.Time `json:"trashedAt"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type Note struct {
	InternalLinks   []NoteLink `json:"internalLinks"`
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	ContentMarkdown string     `json:"contentMarkdown"`
	Tags            []string   `json:"tags"`
	TodoIDs         []string   `json:"todoIds"`
	IsPinned        bool       `json:"isPinned"`
	IsFavorite      bool       `json:"isFavorite"`
	IsArchived      bool       `json:"isArchived"`
	IsTrashed       bool       `json:"isTrashed"`
	TrashedAt       *time.Time `json:"trashedAt"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type Subitem struct {
	ID          string    `json:"id"`
	TodoID      string    `json:"todoId"`
	Content     string    `json:"content"`
	IsCompleted bool      `json:"isCompleted"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateTodoInput struct {
	GroupID        string   `json:"groupId"`
	Title          string   `json:"title"`
	Summary        string   `json:"summary"`
	DetailMarkdown string   `json:"detailMarkdown"`
	DueDate        string   `json:"dueDate"`
	Priority       string   `json:"priority"`
	ReminderAt     string   `json:"reminderAt"`
	Tags           []string `json:"tags"`
	NoteIDs        []string `json:"noteIds"`
}

type UpdateTodoInput struct {
	DatabasePath   string   `json:"databasePath"`
	ID             string   `json:"id"`
	GroupID        string   `json:"groupId"`
	Title          string   `json:"title"`
	Summary        string   `json:"summary"`
	DetailMarkdown string   `json:"detailMarkdown"`
	DueDate        string   `json:"dueDate"`
	Priority       string   `json:"priority"`
	ReminderAt     string   `json:"reminderAt"`
	Tags           []string `json:"tags"`
	NoteIDs        []string `json:"noteIds"`
	IsFavorite     bool     `json:"isFavorite"`
	IsArchived     bool     `json:"isArchived"`
}

type CreateTodoSubitemInput struct {
	TodoID  string `json:"todoId"`
	Content string `json:"content"`
}

type DeleteTodoSubitemsInput struct {
	TodoID string   `json:"todoId"`
	IDs    []string `json:"ids"`
}

type ToggleTodoSubitemInput struct {
	TodoID string `json:"todoId"`
	ID     string `json:"id"`
}

type UpdateTodoSubitemInput struct {
	TodoID  string `json:"todoId"`
	ID      string `json:"id"`
	Content string `json:"content"`
}

type CreateGroupInput struct {
	Name string `json:"name"`
}

type UpdateGroupInput struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type DeleteGroupInput struct {
	ID          string `json:"id"`
	DeleteTodos bool   `json:"deleteTodos"`
}

type CreateNoteInput struct {
	Title           string   `json:"title"`
	ContentMarkdown string   `json:"contentMarkdown"`
	Tags            []string `json:"tags"`
}

type UpdateNoteInput struct {
	DatabasePath    string   `json:"databasePath"`
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	ContentMarkdown string   `json:"contentMarkdown"`
	Tags            []string `json:"tags"`
	TodoIDs         []string `json:"todoIds"`
	IsPinned        bool     `json:"isPinned"`
	IsFavorite      bool     `json:"isFavorite"`
	IsArchived      bool     `json:"isArchived"`
}

type TrashData struct {
	Groups []Group `json:"groups"`
	Todos  []Todo  `json:"todos"`
	Notes  []Note  `json:"notes"`
}

func NewManager(cfg *config.AppConfig) (*Manager, error) {
	db, err := openDB(cfg.DBPath)
	if err != nil {
		return nil, err
	}
	return &Manager{db: db, cfg: cfg}, nil
}

func (m *Manager) Close() error {
	if m.db == nil {
		return nil
	}
	return m.db.Close()
}

func (m *Manager) Switch(cfg *config.AppConfig) error {
	db, err := openDB(cfg.DBPath)
	if err != nil {
		return err
	}

	oldDB := m.db
	m.db = db
	m.cfg = cfg

	if oldDB != nil {
		_ = oldDB.Close()
	}
	return nil
}

func (m *Manager) ListTodos() ([]Todo, error) {
	return m.listTodos(false)
}

func (m *Manager) listTodos(trashed bool) ([]Todo, error) {
	rows, err := m.db.Query(`
		SELECT id, group_id, title, summary, detail_markdown, is_completed, due_date,
			priority, reminder_at, tags_json, is_favorite, is_archived,
			is_trashed, trashed_at, created_at, updated_at
		FROM todos
		WHERE is_trashed = ?
		ORDER BY created_at DESC
	`, trashed)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	todos := make([]Todo, 0)
	for rows.Next() {
		var todo Todo
		var dueDate, reminderAt, tagsJSON sql.NullString
		var trashedAt sql.NullTime
		if err := rows.Scan(
			&todo.ID,
			&todo.GroupID,
			&todo.Title,
			&todo.Summary,
			&todo.DetailMarkdown,
			&todo.IsCompleted,
			&dueDate,
			&todo.Priority,
			&reminderAt,
			&tagsJSON,
			&todo.IsFavorite,
			&todo.IsArchived,
			&todo.IsTrashed,
			&trashedAt,
			&todo.CreatedAt,
			&todo.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan todo: %w", err)
		}
		todo.DueDate = nullableString(dueDate)
		todo.ReminderAt = nullableString(reminderAt)
		todo.Tags = decodeStringList(nullableString(tagsJSON))
		if trashedAt.Valid {
			value := trashedAt.Time
			todo.TrashedAt = &value
		}
		todos = append(todos, todo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	_ = rows.Close()
	if err := m.loadTodoDetails(todos); err != nil {
		return nil, err
	}
	return todos, nil
}

func (m *Manager) ListGroups() ([]Group, error) {
	return m.listGroups(false)
}

func (m *Manager) listGroups(trashed bool) ([]Group, error) {
	rows, err := m.db.Query(`
		SELECT id, name, is_trashed, trashed_at, created_at, updated_at
		FROM todo_groups
		WHERE is_trashed = ?
		ORDER BY created_at ASC
	`, trashed)
	if err != nil {
		return nil, fmt.Errorf("query groups: %w", err)
	}
	defer rows.Close()

	groups := make([]Group, 0)
	for rows.Next() {
		var group Group
		var trashedAt sql.NullTime
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&group.IsTrashed,
			&trashedAt,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		if trashedAt.Valid {
			value := trashedAt.Time
			group.TrashedAt = &value
		}
		groups = append(groups, group)
	}

	return groups, rows.Err()
}

func (m *Manager) ListNotes() ([]Note, error) {
	return m.listNotes(false)
}

func (m *Manager) listNotes(trashed bool) ([]Note, error) {
	rows, err := m.db.Query(`
		SELECT id, title, content_markdown, tags_json, internal_links_json, is_pinned, is_favorite,
			is_archived, is_trashed, trashed_at, created_at, updated_at
		FROM notes
		WHERE is_trashed = ?
		ORDER BY updated_at DESC
	`, trashed)
	if err != nil {
		return nil, fmt.Errorf("query notes: %w", err)
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		var note Note
		var tagsJSON sql.NullString
		var internalLinksJSON string
		var trashedAt sql.NullTime
		if err := rows.Scan(
			&note.ID,
			&note.Title,
			&note.ContentMarkdown,
			&tagsJSON,
			&internalLinksJSON,
			&note.IsPinned,
			&note.IsFavorite,
			&note.IsArchived,
			&note.IsTrashed,
			&trashedAt,
			&note.CreatedAt,
			&note.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan note: %w", err)
		}
		note.Tags = decodeStringList(nullableString(tagsJSON))
		note.InternalLinks, err = decodeNoteLinks(internalLinksJSON)
		if err != nil {
			return nil, err
		}
		if trashedAt.Valid {
			value := trashedAt.Time
			note.TrashedAt = &value
		}
		notes = append(notes, note)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	_ = rows.Close()
	if err := m.loadNoteDetails(notes); err != nil {
		return nil, err
	}
	return notes, nil
}

func (m *Manager) ListTrash() (*TrashData, error) {
	groups, err := m.listGroups(true)
	if err != nil {
		return nil, err
	}
	todos, err := m.listTodos(true)
	if err != nil {
		return nil, err
	}
	notes, err := m.listNotes(true)
	if err != nil {
		return nil, err
	}
	return &TrashData{Groups: groups, Todos: todos, Notes: notes}, nil
}

func (m *Manager) CreateNote(input CreateNoteInput) (*Note, error) {
	now := time.Now()
	id := fmt.Sprintf("note-%d", now.UnixNano())
	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin create note tx: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`
		INSERT INTO notes (id, title, content_markdown, tags_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, input.Title, normalizeMarkdown(input.ContentMarkdown), encodeStringList(input.Tags), now, now); err != nil {
		return nil, fmt.Errorf("insert note: %w", err)
	}
	if err := bindAllNoteReferences(tx); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create note tx: %w", err)
	}

	return m.findNoteByID(id)
}

func (m *Manager) UpdateNote(input UpdateNoteInput) (*Note, error) {
	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin update note tx: %w", err)
	}
	defer tx.Rollback()
	var oldTitle string
	if err := tx.QueryRow(`SELECT title FROM notes WHERE id = ? AND is_trashed = 0`, input.ID).Scan(&oldTitle); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("note not found")
		}
		return nil, fmt.Errorf("query note title tx: %w", err)
	}
	if oldTitle != input.Title {
		if err := bindAllNoteReferences(tx); err != nil {
			return nil, err
		}
	}
	result, err := tx.Exec(`
		UPDATE notes
		SET title = ?, content_markdown = ?, tags_json = ?, is_pinned = ?,
			is_favorite = ?, is_archived = ?, updated_at = ?
		WHERE id = ? AND is_trashed = 0
	`, input.Title, normalizeMarkdown(input.ContentMarkdown), encodeStringList(input.Tags),
		input.IsPinned, input.IsFavorite, input.IsArchived, time.Now(), input.ID)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("update note: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return nil, errors.New("note not found")
	}
	if err := replaceNoteTodoLinks(tx, input.ID, input.TodoIDs); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if err := refreshNoteBindings(tx, input.ID, input.ContentMarkdown); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update note: %w", err)
	}

	return m.findNoteByID(input.ID)
}

func (m *Manager) DeleteNote(id string) error {
	result, err := m.db.Exec(`
		UPDATE notes SET is_trashed = 1, trashed_at = ?, updated_at = ?
		WHERE id = ? AND is_trashed = 0
	`, time.Now(), time.Now(), id)
	if err != nil {
		return fmt.Errorf("trash note: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("note not found")
	}
	return nil
}

func (m *Manager) CreateTodo(input CreateTodoInput) (*Todo, error) {
	now := time.Now()
	id := fmt.Sprintf("%d", now.UnixNano())
	markdown := normalizeMarkdown(input.DetailMarkdown)
	dueDate := normalizeDateString(input.DueDate)
	groupID, err := m.resolveGroupID(input.GroupID)
	if err != nil {
		return nil, err
	}

	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin create todo tx: %w", err)
	}
	_, err = tx.Exec(`
		INSERT INTO todos (
			id, group_id, title, summary, detail_markdown, is_completed, due_date,
			priority, reminder_at, tags_json, created_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
	`, id, groupID, input.Title, input.Summary, markdown, dueDate,
		normalizePriority(input.Priority), normalizeDateString(input.ReminderAt),
		encodeStringList(input.Tags), now, now)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("insert todo: %w", err)
	}
	if err := replaceTodoNoteLinks(tx, id, input.NoteIDs); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create todo: %w", err)
	}

	return m.findByID(id)
}

func (m *Manager) UpdateTodo(input UpdateTodoInput) (*Todo, error) {
	markdown := normalizeMarkdown(input.DetailMarkdown)
	dueDate := normalizeDateString(input.DueDate)
	groupID, err := m.resolveGroupID(input.GroupID)
	if err != nil {
		return nil, err
	}
	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin update todo tx: %w", err)
	}
	result, err := tx.Exec(`
		UPDATE todos
		SET group_id = ?, title = ?, summary = ?, detail_markdown = ?,
			due_date = ?, priority = ?, reminder_at = ?, tags_json = ?,
			is_favorite = ?, is_archived = ?, updated_at = ?
		WHERE id = ? AND is_trashed = 0
	`, groupID, input.Title, input.Summary, markdown, dueDate,
		normalizePriority(input.Priority), normalizeDateString(input.ReminderAt),
		encodeStringList(input.Tags),
		input.IsFavorite, input.IsArchived, time.Now(), input.ID)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("update todo: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return nil, errors.New("todo not found")
	}
	if err := replaceTodoNoteLinks(tx, input.ID, input.NoteIDs); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update todo: %w", err)
	}

	return m.findByID(input.ID)
}

func (m *Manager) CreateGroup(input CreateGroupInput) (*Group, error) {
	now := time.Now()
	id := fmt.Sprintf("group-%d", now.UnixNano())
	result, err := m.db.Exec(`
		INSERT INTO todo_groups (id, name, created_at, updated_at)
		VALUES (?, ?, ?, ?)
	`, id, input.Name, now, now)
	if err != nil {
		return nil, fmt.Errorf("insert group: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, errors.New("group not created")
	}

	return m.findGroupByID(id)
}

func (m *Manager) UpdateGroup(input UpdateGroupInput) (*Group, error) {
	if input.ID == defaultGroupID {
		return nil, errors.New("default group cannot be renamed")
	}

	result, err := m.db.Exec(`
		UPDATE todo_groups
		SET name = ?, updated_at = ?
		WHERE id = ?
	`, input.Name, time.Now(), input.ID)
	if err != nil {
		return nil, fmt.Errorf("update group: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, errors.New("group not found")
	}

	return m.findGroupByID(input.ID)
}

func (m *Manager) DeleteGroup(input DeleteGroupInput) error {
	if input.ID == defaultGroupID {
		return errors.New("default group cannot be deleted")
	}

	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin delete group tx: %w", err)
	}

	if input.DeleteTodos {
		batchID := fmt.Sprintf("group-trash-%d", time.Now().UnixNano())
		if _, err := tx.Exec(`
			UPDATE todos SET is_trashed = 1, trashed_at = ?, updated_at = ?, trash_batch_id = ?
			WHERE group_id = ? AND is_trashed = 0
		`, time.Now(), time.Now(), batchID, input.ID); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("trash group todos: %w", err)
		}
		if _, err := tx.Exec(`UPDATE todo_groups SET trash_batch_id = ? WHERE id = ? AND is_trashed = 0`, batchID, input.ID); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record group trash batch tx: %w", err)
		}
	} else {
		if _, err := tx.Exec(`UPDATE todos SET group_id = ?, updated_at = ? WHERE group_id = ? AND is_trashed = 0`, defaultGroupID, time.Now(), input.ID); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("reassign group todos: %w", err)
		}
	}

	result, err := tx.Exec(`
		UPDATE todo_groups SET is_trashed = 1, trashed_at = ?, updated_at = ?
		WHERE id = ? AND is_trashed = 0
	`, time.Now(), time.Now(), input.ID)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("delete group: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return errors.New("group not found")
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit delete group: %w", err)
	}

	return nil
}

func (m *Manager) DeleteTodo(id string) error {
	result, err := m.db.Exec(`
		UPDATE todos SET is_trashed = 1, trashed_at = ?, trash_batch_id = NULL, updated_at = ?
		WHERE id = ? AND is_trashed = 0
	`, time.Now(), time.Now(), id)
	if err != nil {
		return fmt.Errorf("trash todo: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("todo not found")
	}
	return nil
}

func (m *Manager) ToggleTodoCompleted(id string) (*Todo, error) {
	result, err := m.db.Exec(`
		UPDATE todos
		SET is_completed = NOT is_completed, updated_at = ?
		WHERE id = ? AND is_trashed = 0
	`, time.Now(), id)
	if err != nil {
		return nil, fmt.Errorf("toggle todo: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("read toggle todo result: %w", err)
	}
	if rows == 0 {
		return nil, errors.New("todo not found")
	}

	return m.findByID(id)
}

func (m *Manager) CreateTodoSubitem(input CreateTodoSubitemInput) (*Todo, error) {
	now := time.Now()
	id := fmt.Sprintf("%d", now.UnixNano())

	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin create subitem tx: %w", err)
	}

	if _, err := tx.Exec(`
		INSERT INTO todo_subitems (id, todo_id, content, is_completed, created_at, updated_at)
		VALUES (?, ?, ?, 0, ?, ?)
	`, id, input.TodoID, input.Content, now, now); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("insert subitem: %w", err)
	}

	if err := touchTodo(tx, input.TodoID, now); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit create subitem: %w", err)
	}

	return m.findByID(input.TodoID)
}

func (m *Manager) DeleteTodoSubitems(input DeleteTodoSubitemsInput) (*Todo, error) {
	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin delete subitems tx: %w", err)
	}

	placeholders := make([]string, 0, len(input.IDs))
	args := make([]interface{}, 0, len(input.IDs)+1)
	args = append(args, input.TodoID)
	for _, id := range input.IDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	query := fmt.Sprintf(
		`DELETE FROM todo_subitems WHERE todo_id = ? AND id IN (%s)`,
		strings.Join(placeholders, ", "),
	)
	if _, err := tx.Exec(query, args...); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("delete subitems: %w", err)
	}

	if err := touchTodo(tx, input.TodoID, time.Now()); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit delete subitems: %w", err)
	}

	return m.findByID(input.TodoID)
}

func (m *Manager) ToggleTodoSubitemCompleted(input ToggleTodoSubitemInput) (*Todo, error) {
	var current bool
	err := m.db.QueryRow(`
		SELECT is_completed
		FROM todo_subitems
		WHERE id = ? AND todo_id = ?
	`, input.ID, input.TodoID).Scan(&current)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("todo subitem not found")
		}
		return nil, fmt.Errorf("query subitem: %w", err)
	}

	now := time.Now()
	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin toggle subitem tx: %w", err)
	}

	result, err := tx.Exec(`
		UPDATE todo_subitems
		SET is_completed = ?, updated_at = ?
		WHERE id = ? AND todo_id = ?
	`, !current, now, input.ID, input.TodoID)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("toggle subitem: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return nil, errors.New("todo subitem not found")
	}

	if err := touchTodo(tx, input.TodoID, now); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit toggle subitem: %w", err)
	}

	return m.findByID(input.TodoID)
}

func (m *Manager) UpdateTodoSubitem(input UpdateTodoSubitemInput) (*Todo, error) {
	now := time.Now()
	tx, err := m.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin update subitem tx: %w", err)
	}

	result, err := tx.Exec(`
		UPDATE todo_subitems
		SET content = ?, updated_at = ?
		WHERE id = ? AND todo_id = ?
	`, input.Content, now, input.ID, input.TodoID)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("update subitem: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return nil, errors.New("todo subitem not found")
	}

	if err := touchTodo(tx, input.TodoID, now); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit update subitem: %w", err)
	}

	return m.findByID(input.TodoID)
}

func (m *Manager) findByID(id string) (*Todo, error) {
	var todo Todo
	var dueDate, reminderAt, tagsJSON sql.NullString
	var trashedAt sql.NullTime
	err := m.db.QueryRow(`
		SELECT id, group_id, title, summary, detail_markdown, is_completed, due_date,
			priority, reminder_at, tags_json, is_favorite, is_archived,
			is_trashed, trashed_at, created_at, updated_at
		FROM todos
		WHERE id = ?
	`, id).Scan(
		&todo.ID,
		&todo.GroupID,
		&todo.Title,
		&todo.Summary,
		&todo.DetailMarkdown,
		&todo.IsCompleted,
		&dueDate,
		&todo.Priority,
		&reminderAt,
		&tagsJSON,
		&todo.IsFavorite,
		&todo.IsArchived,
		&todo.IsTrashed,
		&trashedAt,
		&todo.CreatedAt,
		&todo.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("todo not found")
		}
		return nil, fmt.Errorf("query todo: %w", err)
	}
	todo.DueDate = nullableString(dueDate)
	todo.ReminderAt = nullableString(reminderAt)
	todo.Tags = decodeStringList(nullableString(tagsJSON))
	if trashedAt.Valid {
		value := trashedAt.Time
		todo.TrashedAt = &value
	}
	if err := m.loadSubitems(&todo); err != nil {
		return nil, err
	}
	if err := m.loadTodoNoteIDs(&todo); err != nil {
		return nil, err
	}
	return &todo, nil
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(`PRAGMA busy_timeout = 5000`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("set sqlite busy timeout: %w", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todo_groups (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			is_trashed INTEGER NOT NULL DEFAULT 0,
			trashed_at TIMESTAMP NULL,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todo_groups table: %w", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todos (
			id TEXT PRIMARY KEY,
			group_id TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL,
			summary TEXT NOT NULL DEFAULT '',
			detail_markdown TEXT NOT NULL DEFAULT '',
			is_completed INTEGER NOT NULL DEFAULT 0,
			due_date TEXT NULL,
			priority TEXT NOT NULL DEFAULT 'q4',
			reminder_at TEXT NULL,
			tags_json TEXT NOT NULL DEFAULT '[]',
			is_favorite INTEGER NOT NULL DEFAULT 0,
			is_archived INTEGER NOT NULL DEFAULT 0,
			is_trashed INTEGER NOT NULL DEFAULT 0,
			trashed_at TIMESTAMP NULL,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todos table: %w", err)
	}

	if err := ensureTodoSchema(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := ensureDefaultGroup(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := ensureTodoGroupAssignments(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todo_subitems (
			id TEXT PRIMARY KEY,
			todo_id TEXT NOT NULL,
			content TEXT NOT NULL,
			is_completed INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todo_subitems table: %w", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS notes (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content_markdown TEXT NOT NULL DEFAULT '',
			tags_json TEXT NOT NULL DEFAULT '[]',
			is_pinned INTEGER NOT NULL DEFAULT 0,
			is_favorite INTEGER NOT NULL DEFAULT 0,
			is_archived INTEGER NOT NULL DEFAULT 0,
			is_trashed INTEGER NOT NULL DEFAULT 0,
			trashed_at TIMESTAMP NULL,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create notes table: %w", err)
	}

	if err := ensureProductivitySchema(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todo_note_links (
			todo_id TEXT NOT NULL,
			note_id TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL,
			PRIMARY KEY (todo_id, note_id)
		)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todo_note_links table: %w", err)
	}

	if _, err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_todo_subitems_todo_created_at
		ON todo_subitems (todo_id, created_at)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todo_subitems index: %w", err)
	}

	if _, err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_notes_updated_at
		ON notes (updated_at DESC)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create notes index: %w", err)
	}

	if err := initializeNoteBindings(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := purgeExpiredTrash(db, time.Now().AddDate(0, 0, -trashRetentionDays)); err != nil {
		_ = db.Close()
		return nil, err
	}

	return db, nil
}

func (m *Manager) findNoteByID(id string) (*Note, error) {
	var note Note
	var tagsJSON sql.NullString
	var internalLinksJSON string
	var trashedAt sql.NullTime
	err := m.db.QueryRow(`
		SELECT id, title, content_markdown, tags_json, internal_links_json, is_pinned, is_favorite,
			is_archived, is_trashed, trashed_at, created_at, updated_at
		FROM notes
		WHERE id = ?
	`, id).Scan(
		&note.ID,
		&note.Title,
		&note.ContentMarkdown,
		&tagsJSON,
		&internalLinksJSON,
		&note.IsPinned,
		&note.IsFavorite,
		&note.IsArchived,
		&note.IsTrashed,
		&trashedAt,
		&note.CreatedAt,
		&note.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("note not found")
		}
		return nil, fmt.Errorf("query note: %w", err)
	}
	note.Tags = decodeStringList(nullableString(tagsJSON))
	note.InternalLinks, err = decodeNoteLinks(internalLinksJSON)
	if err != nil {
		return nil, err
	}
	if trashedAt.Valid {
		value := trashedAt.Time
		note.TrashedAt = &value
	}
	if err := m.loadNoteTodoIDs(&note); err != nil {
		return nil, err
	}
	return &note, nil
}

func (m *Manager) findGroupByID(id string) (*Group, error) {
	var group Group
	var trashedAt sql.NullTime
	err := m.db.QueryRow(`
		SELECT id, name, is_trashed, trashed_at, created_at, updated_at
		FROM todo_groups
		WHERE id = ?
	`, id).Scan(
		&group.ID,
		&group.Name,
		&group.IsTrashed,
		&trashedAt,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("group not found")
		}
		return nil, fmt.Errorf("query group: %w", err)
	}
	if trashedAt.Valid {
		value := trashedAt.Time
		group.TrashedAt = &value
	}
	return &group, nil
}

func (m *Manager) resolveGroupID(groupID string) (string, error) {
	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		return defaultGroupID, nil
	}

	var count int
	if err := m.db.QueryRow(`SELECT COUNT(1) FROM todo_groups WHERE id = ? AND is_trashed = 0`, groupID).Scan(&count); err != nil {
		return "", fmt.Errorf("check group: %w", err)
	}
	if count == 0 {
		return "", errors.New("group not found")
	}
	return groupID, nil
}

func (m *Manager) loadSubitems(todo *Todo) error {
	subitems, err := m.listSubitems(todo.ID)
	if err != nil {
		return err
	}
	todo.Subitems = subitems
	return nil
}

func (m *Manager) listSubitems(todoID string) ([]Subitem, error) {
	rows, err := m.db.Query(`
		SELECT id, todo_id, content, is_completed, created_at, updated_at
		FROM todo_subitems
		WHERE todo_id = ?
		ORDER BY created_at ASC
	`, todoID)
	if err != nil {
		return nil, fmt.Errorf("query subitems: %w", err)
	}
	defer rows.Close()

	subitems := make([]Subitem, 0)
	for rows.Next() {
		var item Subitem
		if err := rows.Scan(
			&item.ID,
			&item.TodoID,
			&item.Content,
			&item.IsCompleted,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan subitem: %w", err)
		}
		subitems = append(subitems, item)
	}

	return subitems, rows.Err()
}

func touchTodo(tx *sql.Tx, todoID string, updatedAt time.Time) error {
	result, err := tx.Exec(`UPDATE todos SET updated_at = ? WHERE id = ?`, updatedAt, todoID)
	if err != nil {
		return fmt.Errorf("touch todo: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("todo not found")
	}

	return nil
}

func normalizeDateString(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func nullableString(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func ensureTodoSchema(db *sql.DB) error {
	if _, err := db.Exec(`ALTER TABLE todos ADD COLUMN due_date TEXT NULL`); err != nil {
		errText := strings.ToLower(err.Error())
		if !strings.Contains(errText, "duplicate column name") {
			return fmt.Errorf("ensure due_date column: %w", err)
		}
	}
	if _, err := db.Exec(`ALTER TABLE todos ADD COLUMN group_id TEXT NOT NULL DEFAULT ''`); err != nil {
		errText := strings.ToLower(err.Error())
		if !strings.Contains(errText, "duplicate column name") {
			return fmt.Errorf("ensure group_id column: %w", err)
		}
	}
	return nil
}

func ensureProductivitySchema(db *sql.DB) error {
	columns := []struct {
		table      string
		definition string
		label      string
	}{
		{"todo_groups", "is_trashed INTEGER NOT NULL DEFAULT 0", "group is_trashed"},
		{"todo_groups", "trashed_at TIMESTAMP NULL", "group trashed_at"},
		{"todo_groups", "trash_batch_id TEXT NULL", "group trash_batch_id"},
		{"todos", "priority TEXT NOT NULL DEFAULT 'q4'", "todo priority"},
		{"todos", "reminder_at TEXT NULL", "todo reminder_at"},
		{"todos", "tags_json TEXT NOT NULL DEFAULT '[]'", "todo tags_json"},
		{"todos", "is_favorite INTEGER NOT NULL DEFAULT 0", "todo is_favorite"},
		{"todos", "is_archived INTEGER NOT NULL DEFAULT 0", "todo is_archived"},
		{"todos", "is_trashed INTEGER NOT NULL DEFAULT 0", "todo is_trashed"},
		{"todos", "trashed_at TIMESTAMP NULL", "todo trashed_at"},
		{"todos", "trash_batch_id TEXT NULL", "todo trash_batch_id"},
		{"notes", "tags_json TEXT NOT NULL DEFAULT '[]'", "note tags_json"},
		{"notes", "internal_links_json TEXT NOT NULL DEFAULT '[]'", "note internal_links_json"},
		{"notes", "is_pinned INTEGER NOT NULL DEFAULT 0", "note is_pinned"},
		{"notes", "is_favorite INTEGER NOT NULL DEFAULT 0", "note is_favorite"},
		{"notes", "is_archived INTEGER NOT NULL DEFAULT 0", "note is_archived"},
		{"notes", "is_trashed INTEGER NOT NULL DEFAULT 0", "note is_trashed"},
		{"notes", "trashed_at TIMESTAMP NULL", "note trashed_at"},
	}
	for _, column := range columns {
		if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s", column.table, column.definition)); err != nil {
			errText := strings.ToLower(err.Error())
			if !strings.Contains(errText, "duplicate column name") {
				return fmt.Errorf("ensure %s column: %w", column.label, err)
			}
		}
	}
	if _, err := db.Exec(`
		UPDATE todos
		SET priority = CASE LOWER(TRIM(priority))
			WHEN 'q1' THEN 'q1'
			WHEN 'high' THEN 'q1'
			WHEN 'q2' THEN 'q2'
			WHEN 'medium' THEN 'q2'
			WHEN 'q3' THEN 'q3'
			WHEN 'q4' THEN 'q4'
			WHEN 'normal' THEN 'q4'
			ELSE 'q4'
		END
	`); err != nil {
		return fmt.Errorf("migrate todo priorities: %w", err)
	}
	if _, err := db.Exec(`UPDATE todo_groups SET is_trashed = 0, trashed_at = NULL WHERE id = ?`, defaultGroupID); err != nil {
		return fmt.Errorf("restore default group: %w", err)
	}
	return removeLegacyTodoRepeatColumn(db)
}

func removeLegacyTodoRepeatColumn(db *sql.DB) error {
	rows, err := db.Query(`PRAGMA table_info(todos)`)
	if err != nil {
		return fmt.Errorf("inspect legacy todo columns: %w", err)
	}
	var found bool
	for rows.Next() {
		var cid, notNull, primaryKey int
		var name, columnType string
		var defaultValue sql.NullString
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan legacy todo column: %w", err)
		}
		found = found || name == "recurrence"
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("read legacy todo columns: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close legacy todo columns: %w", err)
	}
	if found {
		if _, err := db.Exec(`ALTER TABLE todos DROP COLUMN recurrence`); err != nil {
			return fmt.Errorf("remove legacy todo repeat column: %w", err)
		}
	}
	return nil
}

const (
	defaultGroupID   = "default"
	defaultGroupName = "默认分组"
)

func ensureDefaultGroup(db *sql.DB) error {
	now := time.Now()
	if _, err := db.Exec(`
		INSERT INTO todo_groups (id, name, created_at, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(id) DO NOTHING
	`, defaultGroupID, defaultGroupName, now, now); err != nil {
		return fmt.Errorf("ensure default group: %w", err)
	}
	if _, err := db.Exec(`
		UPDATE todo_groups
		SET name = ?, updated_at = ?
		WHERE id = ? AND name <> ?
	`, defaultGroupName, now, defaultGroupID, defaultGroupName); err != nil {
		return fmt.Errorf("normalize default group name: %w", err)
	}
	return nil
}

func ensureTodoGroupAssignments(db *sql.DB) error {
	if _, err := db.Exec(`
		UPDATE todos
		SET group_id = ?
		WHERE group_id IS NULL OR TRIM(group_id) = ''
	`, defaultGroupID); err != nil {
		return fmt.Errorf("assign default group: %w", err)
	}
	return nil
}

func normalizeMarkdown(markdown string) string {
	markdown = strings.ReplaceAll(markdown, "\r\n", "\n")
	markdown = strings.ReplaceAll(markdown, "\r", "\n")
	return markdown
}
