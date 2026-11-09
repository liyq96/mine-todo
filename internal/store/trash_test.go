package store

import "testing"

func seedPurgeTrash(t *testing.T) (*Manager, *Todo, *Note) {
	t.Helper()
	manager := newTestManager(t)
	activeGroup, err := manager.CreateGroup(CreateGroupInput{Name: "Keep"})
	if err != nil {
		t.Fatalf("create active group: %v", err)
	}
	trashGroup, err := manager.CreateGroup(CreateGroupInput{Name: "Trash"})
	if err != nil {
		t.Fatalf("create trash group: %v", err)
	}
	activeNote, err := manager.CreateNote(CreateNoteInput{Title: "Keep note", ContentMarkdown: "Keep content"})
	if err != nil {
		t.Fatalf("create active note: %v", err)
	}
	trashNote, err := manager.CreateNote(CreateNoteInput{Title: "Trash note"})
	if err != nil {
		t.Fatalf("create trash note: %v", err)
	}
	var activeTodo *Todo
	for index, groupID := range []string{activeGroup.ID, defaultGroupID, trashGroup.ID} {
		todo, err := manager.CreateTodo(CreateTodoInput{
			GroupID: groupID, Title: "Task", Summary: "Keep summary", Priority: "q3",
			NoteIDs: []string{activeNote.ID, trashNote.ID},
		})
		if err != nil {
			t.Fatalf("create todo: %v", err)
		}
		if _, err := manager.CreateTodoSubitem(CreateTodoSubitemInput{TodoID: todo.ID, Content: "Subitem"}); err != nil {
			t.Fatalf("create subitem: %v", err)
		}
		if index == 0 {
			activeTodo = todo
		} else if index == 1 {
			if err := manager.DeleteTodo(todo.ID); err != nil {
				t.Fatalf("trash todo: %v", err)
			}
		}
	}
	if err := manager.DeleteGroup(DeleteGroupInput{ID: trashGroup.ID, DeleteTodos: true}); err != nil {
		t.Fatalf("trash group: %v", err)
	}
	if err := manager.DeleteNote(trashNote.ID); err != nil {
		t.Fatalf("trash note: %v", err)
	}
	return manager, activeTodo, activeNote
}

func TestPurgeTrashPhysicallyRemovesOnlyTrashedData(t *testing.T) {
	manager, activeTodo, activeNote := seedPurgeTrash(t)
	for attempt := 0; attempt < 2; attempt++ {
		if err := manager.PurgeTrash(); err != nil {
			t.Fatalf("purge trash: %v", err)
		}
		for table, expected := range map[string]int{
			"todo_groups": 2, "todos": 1, "todo_subitems": 1, "notes": 1, "todo_note_links": 1,
		} {
			var count int
			if err := manager.db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count); err != nil || count != expected {
				t.Fatalf("physical rows in %s: got %d, want %d, err %v", table, count, expected, err)
			}
		}
		trash, err := manager.ListTrash()
		if err != nil || len(trash.Groups)+len(trash.Todos)+len(trash.Notes) != 0 {
			t.Fatalf("trash was not emptied: %+v, err %v", trash, err)
		}
		todos, err := manager.ListTodos()
		if err != nil || len(todos) != 1 || todos[0].ID != activeTodo.ID || todos[0].Priority != "q3" || todos[0].Summary != "Keep summary" || len(todos[0].Subitems) != 1 || len(todos[0].NoteIDs) != 1 || todos[0].NoteIDs[0] != activeNote.ID {
			t.Fatalf("active todo was damaged: %+v, err %v", todos, err)
		}
		note, err := manager.findNoteByID(activeNote.ID)
		if err != nil || note.ContentMarkdown != "Keep content" || len(note.TodoIDs) != 1 || note.TodoIDs[0] != activeTodo.ID {
			t.Fatalf("active note was damaged: %+v, err %v", note, err)
		}
		if _, err := manager.findGroupByID(defaultGroupID); err != nil {
			t.Fatalf("default group was removed: %v", err)
		}
	}
}

func TestPurgeTrashRollsBackOnFailure(t *testing.T) {
	manager, _, _ := seedPurgeTrash(t)
	if _, err := manager.db.Exec(`CREATE TRIGGER fail_empty_trash BEFORE DELETE ON notes
		WHEN OLD.is_trashed = 1 BEGIN SELECT RAISE(ABORT, 'test purge failure'); END`); err != nil {
		t.Fatalf("create failure trigger: %v", err)
	}
	if err := manager.PurgeTrash(); err == nil {
		t.Fatal("expected purge failure")
	}
	for table, expected := range map[string]int{
		"todo_groups": 3, "todos": 3, "todo_subitems": 3, "notes": 2, "todo_note_links": 6,
	} {
		var count int
		if err := manager.db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count); err != nil || count != expected {
			t.Fatalf("rollback did not preserve %s: got %d, want %d, err %v", table, count, expected, err)
		}
	}
	trash, err := manager.ListTrash()
	if err != nil || len(trash.Groups) != 1 || len(trash.Todos) != 2 || len(trash.Notes) != 1 {
		t.Fatalf("rollback changed trash: %+v, err %v", trash, err)
	}
}
