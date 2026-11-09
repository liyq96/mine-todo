package store

import "fmt"

func (m *Manager) loadTodoDetails(todos []Todo) error {
	byID := make(map[string]*Todo, len(todos))
	for index := range todos {
		todos[index].Subitems = make([]Subitem, 0)
		todos[index].NoteIDs = make([]string, 0)
		byID[todos[index].ID] = &todos[index]
	}
	if len(todos) == 0 {
		return nil
	}
	rows, err := m.db.Query(`SELECT id, todo_id, content, is_completed, created_at, updated_at FROM todo_subitems ORDER BY created_at`)
	if err != nil {
		return fmt.Errorf("query todo subitems in batch: %w", err)
	}
	for rows.Next() {
		var item Subitem
		if err := rows.Scan(&item.ID, &item.TodoID, &item.Content, &item.IsCompleted, &item.CreatedAt, &item.UpdatedAt); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan todo subitem in batch: %w", err)
		}
		if todo := byID[item.TodoID]; todo != nil {
			todo.Subitems = append(todo.Subitems, item)
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("iterate todo subitems in batch: %w", err)
	}
	_ = rows.Close()
	rows, err = m.db.Query(`SELECT l.todo_id, l.note_id FROM todo_note_links l JOIN notes n ON n.id = l.note_id WHERE n.is_trashed = 0 ORDER BY l.created_at`)
	if err != nil {
		return fmt.Errorf("query todo links in batch: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var todoID, noteID string
		if err := rows.Scan(&todoID, &noteID); err != nil {
			return fmt.Errorf("scan todo link in batch: %w", err)
		}
		if todo := byID[todoID]; todo != nil {
			todo.NoteIDs = append(todo.NoteIDs, noteID)
		}
	}
	return rows.Err()
}

func (m *Manager) loadNoteDetails(notes []Note) error {
	byID := make(map[string]*Note, len(notes))
	for index := range notes {
		notes[index].TodoIDs = make([]string, 0)
		byID[notes[index].ID] = &notes[index]
	}
	if len(notes) == 0 {
		return nil
	}
	rows, err := m.db.Query(`SELECT l.note_id, l.todo_id FROM todo_note_links l JOIN todos t ON t.id = l.todo_id WHERE t.is_trashed = 0 ORDER BY l.created_at`)
	if err != nil {
		return fmt.Errorf("query note links in batch: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var noteID, todoID string
		if err := rows.Scan(&noteID, &todoID); err != nil {
			return fmt.Errorf("scan note link in batch: %w", err)
		}
		if note := byID[noteID]; note != nil {
			note.TodoIDs = append(note.TodoIDs, todoID)
		}
	}
	return rows.Err()
}
