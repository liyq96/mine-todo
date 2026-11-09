package store

import (
	"path/filepath"
	"testing"

	"mine-todo/internal/config"
)

func integrityManager(t *testing.T) *Manager {
	t.Helper()
	path := t.TempDir()
	manager, err := NewManager(&config.AppConfig{StorageDir: path, DBPath: filepath.Join(path, "todo.db")})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = manager.Close() })
	return manager
}

func TestGroupRestoreOnlyRestoresItsOwnDeleteBatch(t *testing.T) {
	manager := integrityManager(t)
	group, err := manager.CreateGroup(CreateGroupInput{Name: "project"})
	if err != nil {
		t.Fatal(err)
	}
	independent, err := manager.CreateTodo(CreateTodoInput{GroupID: group.ID, Title: "independent"})
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.DeleteTodo(independent.ID); err != nil {
		t.Fatal(err)
	}
	child, err := manager.CreateTodo(CreateTodoInput{GroupID: group.ID, Title: "child"})
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.DeleteGroup(DeleteGroupInput{ID: group.ID, DeleteTodos: true}); err != nil {
		t.Fatal(err)
	}
	if err := manager.RestoreGroup(group.ID); err != nil {
		t.Fatal(err)
	}
	active, err := manager.ListTodos()
	if err != nil || len(active) != 1 || active[0].ID != child.ID {
		t.Fatalf("wrong restored todos: %v, %v", active, err)
	}
	trash, err := manager.ListTrash()
	if err != nil || len(trash.Todos) != 1 || trash.Todos[0].ID != independent.ID {
		t.Fatalf("independent deletion was revived: %v", err)
	}
	if err := manager.DeleteGroup(DeleteGroupInput{ID: group.ID, DeleteTodos: false}); err != nil {
		t.Fatal(err)
	}
	if err := manager.RestoreGroup(group.ID); err != nil {
		t.Fatal(err)
	}
	active, err = manager.ListTodos()
	if err != nil || len(active) != 1 || active[0].GroupID != defaultGroupID {
		t.Fatalf("group-only restore changed children: %v", err)
	}
}

func TestSoftDeletedRelationsAreHiddenAndSurviveUnrelatedEdits(t *testing.T) {
	manager := integrityManager(t)
	note, err := manager.CreateNote(CreateNoteInput{Title: "note"})
	if err != nil {
		t.Fatal(err)
	}
	todo, err := manager.CreateTodo(CreateTodoInput{Title: "todo", NoteIDs: []string{note.ID}})
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.DeleteNote(note.ID); err != nil {
		t.Fatal(err)
	}
	todo, err = manager.findByID(todo.ID)
	if err != nil || len(todo.NoteIDs) != 0 {
		t.Fatal("trashed note still counted")
	}
	if _, err := manager.UpdateTodo(UpdateTodoInput{ID: todo.ID, GroupID: todo.GroupID, Title: "edited"}); err != nil {
		t.Fatal(err)
	}
	if err := manager.RestoreNote(note.ID); err != nil {
		t.Fatal(err)
	}
	note, err = manager.findNoteByID(note.ID)
	if err != nil || len(note.TodoIDs) != 1 {
		t.Fatal("link did not survive note restore")
	}
	if err := manager.DeleteTodo(todo.ID); err != nil {
		t.Fatal(err)
	}
	note, err = manager.findNoteByID(note.ID)
	if err != nil || len(note.TodoIDs) != 0 {
		t.Fatal("trashed todo still counted")
	}
	if _, err := manager.UpdateNote(UpdateNoteInput{ID: note.ID, Title: "edited note"}); err != nil {
		t.Fatal(err)
	}
	if err := manager.RestoreTodo(todo.ID); err != nil {
		t.Fatal(err)
	}
	todo, err = manager.findByID(todo.ID)
	if err != nil || len(todo.NoteIDs) != 1 {
		t.Fatal("link did not survive todo restore")
	}
	if err := manager.DeleteNote(note.ID); err != nil {
		t.Fatal(err)
	}
	if err := manager.PurgeNote(note.ID); err != nil {
		t.Fatal(err)
	}
	todo, err = manager.findByID(todo.ID)
	if err != nil || len(todo.NoteIDs) != 0 {
		t.Fatal("purge retained a link")
	}
}

func TestNoteLinksKeepIdentityAcrossRenameDuplicateAndReopen(t *testing.T) {
	manager := integrityManager(t)
	target, err := manager.CreateNote(CreateNoteInput{Title: "Target [A]"})
	if err != nil {
		t.Fatal(err)
	}
	source, err := manager.CreateNote(CreateNoteInput{Title: "Source", ContentMarkdown: "[[Target [A]]] and [[ Target [A] ]]"})
	if err != nil {
		t.Fatal(err)
	}
	if len(source.InternalLinks) != 1 || source.InternalLinks[0].NoteID != target.ID {
		t.Fatal("reference did not bind")
	}
	if _, err := manager.UpdateNote(UpdateNoteInput{ID: target.ID, Title: "Renamed"}); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.CreateNote(CreateNoteInput{Title: "Target [A]"}); err != nil {
		t.Fatal(err)
	}
	if err := manager.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := NewManager(manager.cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	source, err = reopened.findNoteByID(source.ID)
	if err != nil || len(source.InternalLinks) != 1 || source.InternalLinks[0].NoteID != target.ID {
		t.Fatal("rename or duplicate title redirected reference")
	}
	unresolved, err := reopened.CreateNote(CreateNoteInput{Title: "Unresolved", ContentMarkdown: "[[Future]]"})
	if err != nil {
		t.Fatal(err)
	}
	future, err := reopened.CreateNote(CreateNoteInput{Title: "Future"})
	if err != nil {
		t.Fatal(err)
	}
	unresolved, err = reopened.findNoteByID(unresolved.ID)
	if err != nil || len(unresolved.InternalLinks) != 1 || unresolved.InternalLinks[0].NoteID != future.ID {
		t.Fatal("new target did not bind an existing reference")
	}
}

func TestSnapshotIncludesCommittedWALData(t *testing.T) {
	manager := integrityManager(t)
	if _, err := manager.db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.db.Exec(`PRAGMA wal_autocheckpoint=0`); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.CreateNote(CreateNoteInput{Title: "committed WAL note"}); err != nil {
		t.Fatal(err)
	}
	path := t.TempDir()
	copy, err := manager.PrepareSwitch(&config.AppConfig{StorageDir: path, DBPath: filepath.Join(path, "todo.db")}, true)
	if err != nil {
		t.Fatal(err)
	}
	defer copy.Close()
	notes, err := copy.ListNotes()
	if err != nil || len(notes) != 1 || notes[0].Title != "committed WAL note" {
		t.Fatal("snapshot omitted WAL data")
	}
}
