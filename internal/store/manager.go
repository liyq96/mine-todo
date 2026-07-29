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
	ID             string    `json:"id"`
	GroupID        string    `json:"groupId"`
	Title          string    `json:"title"`
	Summary        string    `json:"summary"`
	DetailMarkdown string    `json:"detailMarkdown"`
	IsCompleted    bool      `json:"isCompleted"`
	DueDate        string    `json:"dueDate"`
	Subitems       []Subitem `json:"subitems"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Group struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
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
	GroupID        string `json:"groupId"`
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	DetailMarkdown string `json:"detailMarkdown"`
	DueDate        string `json:"dueDate"`
}

type UpdateTodoInput struct {
	ID             string `json:"id"`
	GroupID        string `json:"groupId"`
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	DetailMarkdown string `json:"detailMarkdown"`
	IsCompleted    bool   `json:"isCompleted"`
	DueDate        string `json:"dueDate"`
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
	rows, err := m.db.Query(`
		SELECT id, group_id, title, summary, detail_markdown, is_completed, due_date, created_at, updated_at
		FROM todos
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	todos := make([]Todo, 0)
	for rows.Next() {
		var todo Todo
		var dueDate sql.NullString
		if err := rows.Scan(
			&todo.ID,
			&todo.GroupID,
			&todo.Title,
			&todo.Summary,
			&todo.DetailMarkdown,
			&todo.IsCompleted,
			&dueDate,
			&todo.CreatedAt,
			&todo.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan todo: %w", err)
		}
		todo.DueDate = nullableString(dueDate)
		if err := m.loadSubitems(&todo); err != nil {
			return nil, err
		}
		todos = append(todos, todo)
	}

	return todos, rows.Err()
}

func (m *Manager) ListGroups() ([]Group, error) {
	rows, err := m.db.Query(`
		SELECT id, name, created_at, updated_at
		FROM todo_groups
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query groups: %w", err)
	}
	defer rows.Close()

	groups := make([]Group, 0)
	for rows.Next() {
		var group Group
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		groups = append(groups, group)
	}

	return groups, rows.Err()
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

	_, err = m.db.Exec(`
		INSERT INTO todos (id, group_id, title, summary, detail_markdown, is_completed, due_date, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
	`, id, groupID, input.Title, input.Summary, markdown, dueDate, now, now)
	if err != nil {
		return nil, fmt.Errorf("insert todo: %w", err)
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
	result, err := m.db.Exec(`
		UPDATE todos
		SET group_id = ?, title = ?, summary = ?, detail_markdown = ?, is_completed = ?, due_date = ?, updated_at = ?
		WHERE id = ?
	`, groupID, input.Title, input.Summary, markdown, input.IsCompleted, dueDate, time.Now(), input.ID)
	if err != nil {
		return nil, fmt.Errorf("update todo: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, errors.New("todo not found")
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
		if _, err := tx.Exec(`DELETE FROM todo_subitems WHERE todo_id IN (SELECT id FROM todos WHERE group_id = ?)`, input.ID); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("delete group subitems: %w", err)
		}
		if _, err := tx.Exec(`DELETE FROM todos WHERE group_id = ?`, input.ID); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("delete group todos: %w", err)
		}
	} else {
		if _, err := tx.Exec(`UPDATE todos SET group_id = ?, updated_at = ? WHERE group_id = ?`, defaultGroupID, time.Now(), input.ID); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("reassign group todos: %w", err)
		}
	}

	result, err := tx.Exec(`DELETE FROM todo_groups WHERE id = ?`, input.ID)
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
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("begin delete todo tx: %w", err)
	}

	if _, err := tx.Exec(`DELETE FROM todo_subitems WHERE todo_id = ?`, id); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("delete todo subitems: %w", err)
	}

	result, err := tx.Exec(`DELETE FROM todos WHERE id = ?`, id)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("delete todo: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	if rows == 0 {
		_ = tx.Rollback()
		return errors.New("todo not found")
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit delete todo: %w", err)
	}

	return nil
}

func (m *Manager) ToggleTodoCompleted(id string) (*Todo, error) {
	todo, err := m.findByID(id)
	if err != nil {
		return nil, err
	}

	result, err := m.db.Exec(`
		UPDATE todos
		SET is_completed = ?, updated_at = ?
		WHERE id = ?
	`, !todo.IsCompleted, time.Now(), id)
	if err != nil {
		return nil, fmt.Errorf("toggle todo: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
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
	var dueDate sql.NullString
	err := m.db.QueryRow(`
		SELECT id, group_id, title, summary, detail_markdown, is_completed, due_date, created_at, updated_at
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
	if err := m.loadSubitems(&todo); err != nil {
		return nil, err
	}
	return &todo, nil
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todo_groups (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
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
		CREATE INDEX IF NOT EXISTS idx_todo_subitems_todo_created_at
		ON todo_subitems (todo_id, created_at)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todo_subitems index: %w", err)
	}

	return db, nil
}

func (m *Manager) findGroupByID(id string) (*Group, error) {
	var group Group
	err := m.db.QueryRow(`
		SELECT id, name, created_at, updated_at
		FROM todo_groups
		WHERE id = ?
	`, id).Scan(
		&group.ID,
		&group.Name,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("group not found")
		}
		return nil, fmt.Errorf("query group: %w", err)
	}
	return &group, nil
}

func (m *Manager) resolveGroupID(groupID string) (string, error) {
	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		return defaultGroupID, nil
	}

	var count int
	if err := m.db.QueryRow(`SELECT COUNT(1) FROM todo_groups WHERE id = ?`, groupID).Scan(&count); err != nil {
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
		WHERE id = ?
	`, defaultGroupName, now, defaultGroupID); err != nil {
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
