package store

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"mine-todo/internal/config"
)

func TestNoteLifecycle(t *testing.T) {
	storageDir := t.TempDir()
	manager, err := NewManager(&config.AppConfig{
		StorageDir: storageDir,
		DBPath:     filepath.Join(storageDir, "todo.db"),
		Language:   "zh-CN",
	})
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	t.Cleanup(func() {
		if err := manager.Close(); err != nil {
			t.Errorf("close manager: %v", err)
		}
	})

	notes, err := manager.ListNotes()
	if err != nil {
		t.Fatalf("list empty notes: %v", err)
	}
	if len(notes) != 0 {
		t.Fatalf("expected no notes, got %d", len(notes))
	}

	created, err := manager.CreateNote(CreateNoteInput{
		Title:           "First note",
		ContentMarkdown: "# Heading\r\n\r\nBody",
	})
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	if created.ID == "" || created.Title != "First note" {
		t.Fatalf("unexpected created note: %+v", created)
	}
	if created.ContentMarkdown != "# Heading\n\nBody" {
		t.Fatalf("markdown was not normalized: %q", created.ContentMarkdown)
	}

	updated, err := manager.UpdateNote(UpdateNoteInput{
		ID:              created.ID,
		Title:           "Updated note",
		ContentMarkdown: "Updated body",
	})
	if err != nil {
		t.Fatalf("update note: %v", err)
	}
	if updated.Title != "Updated note" || updated.ContentMarkdown != "Updated body" {
		t.Fatalf("unexpected updated note: %+v", updated)
	}

	notes, err = manager.ListNotes()
	if err != nil {
		t.Fatalf("list notes: %v", err)
	}
	if len(notes) != 1 || notes[0].ID != created.ID {
		t.Fatalf("unexpected notes: %+v", notes)
	}

	if err := manager.DeleteNote(created.ID); err != nil {
		t.Fatalf("delete note: %v", err)
	}
	if err := manager.DeleteNote(created.ID); err == nil {
		t.Fatal("expected deleting a missing note to fail")
	}
	trash, err := manager.ListTrash()
	if err != nil || len(trash.Notes) != 1 {
		t.Fatalf("expected trashed note, got %+v, err %v", trash, err)
	}
	if err := manager.RestoreNote(created.ID); err != nil {
		t.Fatalf("restore note: %v", err)
	}
	if err := manager.DeleteNote(created.ID); err != nil {
		t.Fatalf("trash restored note: %v", err)
	}
	if err := manager.PurgeNote(created.ID); err != nil {
		t.Fatalf("purge note: %v", err)
	}
}

func TestProductivityMetadataLinksAndTodoCompletion(t *testing.T) {
	manager := newTestManager(t)
	note, err := manager.CreateNote(CreateNoteInput{Title: "Plan", Tags: []string{"work", "Work", "weekly"}})
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	dueDate := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	todo, err := manager.CreateTodo(CreateTodoInput{
		Title: "Review plan", DueDate: dueDate, Priority: "q1",
		Tags: []string{"work", "review"}, NoteIDs: []string{note.ID},
	})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	if todo.Priority != "q1" || len(todo.NoteIDs) != 1 || len(todo.Tags) != 2 {
		t.Fatalf("unexpected todo metadata: %+v", todo)
	}

	note, err = manager.UpdateNote(UpdateNoteInput{
		ID:              note.ID,
		Title:           note.Title,
		ContentMarkdown: "See [[Other]]",
		Tags:            []string{"weekly"},
		TodoIDs:         []string{todo.ID},
		IsPinned:        true,
		IsFavorite:      true,
	})
	if err != nil {
		t.Fatalf("update note: %v", err)
	}
	if !note.IsPinned || !note.IsFavorite || len(note.TodoIDs) != 1 {
		t.Fatalf("unexpected note metadata: %+v", note)
	}

	if _, err := manager.ToggleTodoCompleted(todo.ID); err != nil {
		t.Fatalf("complete todo: %v", err)
	}
	todos, err := manager.ListTodos()
	if err != nil {
		t.Fatalf("list todos: %v", err)
	}
	if len(todos) != 1 || !todos[0].IsCompleted || todos[0].ID != todo.ID || len(todos[0].NoteIDs) != 1 {
		t.Fatalf("completion must update the original linked todo: %+v", todos)
	}
	if _, err := manager.ToggleTodoCompleted(todo.ID); err != nil {
		t.Fatalf("reopen todo: %v", err)
	}
	if _, err := manager.ToggleTodoCompleted(todo.ID); err != nil {
		t.Fatalf("complete todo again: %v", err)
	}
	todos, err = manager.ListTodos()
	if err != nil || len(todos) != 1 || !todos[0].IsCompleted {
		t.Fatalf("repeated completion must not create copies: %+v, err %v", todos, err)
	}
}

func TestTodoCompletionDoesNotCreateCopies(t *testing.T) {
	manager := newTestManager(t)
	todo, err := manager.CreateTodo(CreateTodoInput{Title: "Task", DueDate: "2026-10-24"})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	for click := 0; click < 6; click++ {
		updated, err := manager.ToggleTodoCompleted(todo.ID)
		if err != nil {
			t.Fatalf("toggle todo: %v", err)
		}
		if updated.ID != todo.ID || updated.IsCompleted != (click%2 == 0) || updated.DueDate != todo.DueDate {
			t.Fatalf("unexpected completion result on click %d: %+v", click, updated)
		}
		todos, err := manager.ListTodos()
		if err != nil || len(todos) != 1 {
			t.Fatalf("circle click created copies: %+v, err %v", todos, err)
		}
	}
}

func TestNormalizePriority(t *testing.T) {
	tests := map[string]string{
		"q1":      "q1",
		"q2":      "q2",
		"q3":      "q3",
		"q4":      "q4",
		"high":    "q1",
		"medium":  "q2",
		"normal":  "q4",
		"unknown": "q4",
		"":        "q4",
	}

	for input, expected := range tests {
		if actual := normalizePriority(input); actual != expected {
			t.Errorf("normalizePriority(%q) = %q, want %q", input, actual, expected)
		}
	}
}

func TestTodoContentSavePreservesCompletion(t *testing.T) {
	manager := newTestManager(t)
	todo, err := manager.CreateTodo(CreateTodoInput{Title: "Task"})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	if _, err := manager.ToggleTodoCompleted(todo.ID); err != nil {
		t.Fatalf("complete todo: %v", err)
	}
	// A debounced editor save may still contain data captured before the click.
	updated, err := manager.UpdateTodo(UpdateTodoInput{
		ID: todo.ID, GroupID: todo.GroupID, Title: todo.Title, Summary: "Edited before completion",
		Priority: todo.Priority,
	})
	if err != nil {
		t.Fatalf("save todo content: %v", err)
	}
	if !updated.IsCompleted {
		t.Fatal("content autosave reverted the circle completion")
	}
	if updated.Summary != "Edited before completion" {
		t.Fatal("content edit was not saved")
	}
}

func TestTodoAndGroupTrashLifecycle(t *testing.T) {
	manager := newTestManager(t)
	group, err := manager.CreateGroup(CreateGroupInput{Name: "Project"})
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	todo, err := manager.CreateTodo(CreateTodoInput{GroupID: group.ID, Title: "Task"})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	if err := manager.DeleteGroup(DeleteGroupInput{ID: group.ID, DeleteTodos: true}); err != nil {
		t.Fatalf("trash group: %v", err)
	}
	trash, err := manager.ListTrash()
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	if len(trash.Groups) != 1 || len(trash.Todos) != 1 {
		t.Fatalf("unexpected trash: %+v", trash)
	}
	if err := manager.RestoreGroup(group.ID); err != nil {
		t.Fatalf("restore group: %v", err)
	}
	todos, err := manager.ListTodos()
	if err != nil || len(todos) != 1 || todos[0].ID != todo.ID {
		t.Fatalf("expected restored todo, got %+v, err %v", todos, err)
	}
	if err := manager.DeleteTodo(todo.ID); err != nil {
		t.Fatalf("trash todo: %v", err)
	}
	if err := manager.PurgeTodo(todo.ID); err != nil {
		t.Fatalf("purge todo: %v", err)
	}
}

func newTestManager(t *testing.T) *Manager {
	t.Helper()
	storageDir := t.TempDir()
	manager, err := NewManager(&config.AppConfig{
		StorageDir: storageDir,
		DBPath:     filepath.Join(storageDir, "todo.db"),
		Language:   "zh-CN",
	})
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	t.Cleanup(func() {
		if err := manager.Close(); err != nil {
			t.Errorf("close manager: %v", err)
		}
	})
	return manager
}

func TestLegacySchemaMigratesWithoutDataLoss(t *testing.T) {
	storageDir := t.TempDir()
	dbPath := filepath.Join(storageDir, "legacy.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open legacy db: %v", err)
	}
	statements := []string{
		`CREATE TABLE todo_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL)`,
		`CREATE TABLE todos (id TEXT PRIMARY KEY, group_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', detail_markdown TEXT NOT NULL DEFAULT '', is_completed INTEGER NOT NULL DEFAULT 0, due_date TEXT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL)`,
		`CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, content_markdown TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL)`,
		`INSERT INTO todo_groups VALUES ('default', '默认分组', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		`INSERT INTO todos VALUES ('legacy-todo', 'default', 'Legacy task', '', '', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		`INSERT INTO notes VALUES ('legacy-note', 'Legacy note', 'Body', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			_ = db.Close()
			t.Fatalf("prepare legacy schema: %v", err)
		}
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close legacy db: %v", err)
	}

	manager, err := NewManager(&config.AppConfig{StorageDir: storageDir, DBPath: dbPath, Language: "zh-CN"})
	if err != nil {
		t.Fatalf("migrate legacy db: %v", err)
	}
	t.Cleanup(func() { _ = manager.Close() })
	todos, err := manager.ListTodos()
	if err != nil || len(todos) != 1 || todos[0].Title != "Legacy task" || todos[0].Priority != "q4" {
		t.Fatalf("legacy todo was not preserved: %+v, err %v", todos, err)
	}
	notes, err := manager.ListNotes()
	if err != nil || len(notes) != 1 || notes[0].Title != "Legacy note" {
		t.Fatalf("legacy note was not preserved: %+v, err %v", notes, err)
	}
}

func TestLegacyRepeatColumnRemovedWithoutDataLoss(t *testing.T) {
	storageDir := t.TempDir()
	cfg := &config.AppConfig{StorageDir: storageDir, DBPath: filepath.Join(storageDir, "todo.db"), Language: "zh-CN"}
	manager, err := NewManager(cfg)
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	note, err := manager.CreateNote(CreateNoteInput{Title: "Linked note"})
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	todo, err := manager.CreateTodo(CreateTodoInput{Title: "Existing task", DueDate: "2026-10-24", NoteIDs: []string{note.ID}})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	if _, err := manager.CreateTodoSubitem(CreateTodoSubitemInput{TodoID: todo.ID, Content: "Existing subitem"}); err != nil {
		t.Fatalf("create subitem: %v", err)
	}
	trashed, err := manager.CreateTodo(CreateTodoInput{Title: "Existing trash"})
	if err != nil {
		t.Fatalf("create trash todo: %v", err)
	}
	if err := manager.DeleteTodo(trashed.ID); err != nil {
		t.Fatalf("trash todo: %v", err)
	}
	if _, err := manager.db.Exec(`ALTER TABLE todos ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'daily'`); err != nil {
		t.Fatalf("prepare old column: %v", err)
	}
	if err := manager.Close(); err != nil {
		t.Fatalf("close manager: %v", err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		manager, err = NewManager(cfg)
		if err != nil {
			t.Fatalf("reopen manager: %v", err)
		}
		var count int
		if err := manager.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('todos') WHERE name = 'recurrence'`).Scan(&count); err != nil || count != 0 {
			t.Fatalf("legacy column was not removed: count %d, err %v", count, err)
		}
		todos, err := manager.ListTodos()
		if err != nil || len(todos) != 1 || todos[0].ID != todo.ID || len(todos[0].Subitems) != 1 || len(todos[0].NoteIDs) != 1 || todos[0].DueDate != todo.DueDate {
			t.Fatalf("migration lost todo data: %+v, err %v", todos, err)
		}
		trash, err := manager.ListTrash()
		if err != nil || len(trash.Todos) != 1 || trash.Todos[0].ID != trashed.ID {
			t.Fatalf("migration lost trash: %+v, err %v", trash, err)
		}
		if err := manager.Close(); err != nil {
			t.Fatalf("close migrated manager: %v", err)
		}
	}
}

func TestDeletedTodoCannotBeRevivedByAutosave(t *testing.T) {
	manager := newTestManager(t)
	todo, err := manager.CreateTodo(CreateTodoInput{Title: "Task"})
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	if err := manager.DeleteTodo(todo.ID); err != nil {
		t.Fatalf("delete todo: %v", err)
	}
	if _, err := manager.UpdateTodo(UpdateTodoInput{ID: todo.ID, Title: "Late edit"}); err == nil {
		t.Fatal("late autosave should reject a trashed todo")
	}
	todos, err := manager.ListTodos()
	if err != nil || len(todos) != 0 {
		t.Fatalf("deleted todo reappeared: %+v, err %v", todos, err)
	}
	trash, err := manager.ListTrash()
	if err != nil || len(trash.Todos) != 1 || trash.Todos[0].ID != todo.ID {
		t.Fatalf("deleted todo missing from trash: %+v, err %v", trash, err)
	}
	if err := manager.RestoreTodo(todo.ID); err != nil {
		t.Fatalf("restore todo: %v", err)
	}
	todos, err = manager.ListTodos()
	if err != nil || len(todos) != 1 || todos[0].ID != todo.ID {
		t.Fatalf("restored todo missing: %+v, err %v", todos, err)
	}
}

func TestExpiredTrashIsPurgedOnOpen(t *testing.T) {
	storageDir := t.TempDir()
	cfg := &config.AppConfig{StorageDir: storageDir, DBPath: filepath.Join(storageDir, "todo.db"), Language: "zh-CN"}
	manager, err := NewManager(cfg)
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	note, err := manager.CreateNote(CreateNoteInput{Title: "Old trash"})
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	if err := manager.DeleteNote(note.ID); err != nil {
		t.Fatalf("trash note: %v", err)
	}
	if _, err := manager.db.Exec(`UPDATE notes SET trashed_at = ? WHERE id = ?`, time.Now().AddDate(0, 0, -31), note.ID); err != nil {
		t.Fatalf("age trashed note: %v", err)
	}
	if err := manager.Close(); err != nil {
		t.Fatalf("close manager: %v", err)
	}

	manager, err = NewManager(cfg)
	if err != nil {
		t.Fatalf("reopen manager: %v", err)
	}
	t.Cleanup(func() { _ = manager.Close() })
	trash, err := manager.ListTrash()
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	if len(trash.Notes) != 0 {
		t.Fatalf("expected expired trash to be purged, got %+v", trash.Notes)
	}
}
