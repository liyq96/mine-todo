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
	Title          string    `json:"title"`
	Summary        string    `json:"summary"`
	DetailMarkdown string    `json:"detailMarkdown"`
	IsCompleted    bool      `json:"isCompleted"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type CreateTodoInput struct {
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	DetailMarkdown string `json:"detailMarkdown"`
}

type UpdateTodoInput struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	DetailMarkdown string `json:"detailMarkdown"`
	IsCompleted    bool   `json:"isCompleted"`
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
		SELECT id, title, summary, detail_markdown, is_completed, created_at, updated_at
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
		if err := rows.Scan(
			&todo.ID,
			&todo.Title,
			&todo.Summary,
			&todo.DetailMarkdown,
			&todo.IsCompleted,
			&todo.CreatedAt,
			&todo.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan todo: %w", err)
		}
		todos = append(todos, todo)
	}

	return todos, rows.Err()
}

func (m *Manager) CreateTodo(input CreateTodoInput) (*Todo, error) {
	now := time.Now()
	id := fmt.Sprintf("%d", now.UnixNano())
	markdown := normalizeMarkdown(input.DetailMarkdown)

	_, err := m.db.Exec(`
		INSERT INTO todos (id, title, summary, detail_markdown, is_completed, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, ?)
	`, id, input.Title, input.Summary, markdown, now, now)
	if err != nil {
		return nil, fmt.Errorf("insert todo: %w", err)
	}

	return m.findByID(id)
}

func (m *Manager) UpdateTodo(input UpdateTodoInput) (*Todo, error) {
	markdown := normalizeMarkdown(input.DetailMarkdown)
	result, err := m.db.Exec(`
		UPDATE todos
		SET title = ?, summary = ?, detail_markdown = ?, is_completed = ?, updated_at = ?
		WHERE id = ?
	`, input.Title, input.Summary, markdown, input.IsCompleted, time.Now(), input.ID)
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

func (m *Manager) DeleteTodo(id string) error {
	result, err := m.db.Exec(`DELETE FROM todos WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete todo: %w", err)
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

func (m *Manager) findByID(id string) (*Todo, error) {
	var todo Todo
	err := m.db.QueryRow(`
		SELECT id, title, summary, detail_markdown, is_completed, created_at, updated_at
		FROM todos
		WHERE id = ?
	`, id).Scan(
		&todo.ID,
		&todo.Title,
		&todo.Summary,
		&todo.DetailMarkdown,
		&todo.IsCompleted,
		&todo.CreatedAt,
		&todo.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("todo not found")
		}
		return nil, fmt.Errorf("query todo: %w", err)
	}
	return &todo, nil
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todos (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			summary TEXT NOT NULL DEFAULT '',
			detail_markdown TEXT NOT NULL DEFAULT '',
			is_completed INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)
	`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("create todos table: %w", err)
	}

	return db, nil
}

func normalizeMarkdown(markdown string) string {
	markdown = strings.ReplaceAll(markdown, "\r\n", "\n")
	markdown = strings.ReplaceAll(markdown, "\r", "\n")
	return markdown
}
