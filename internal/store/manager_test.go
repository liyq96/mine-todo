package store

import (
	"path/filepath"
	"testing"

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
}
