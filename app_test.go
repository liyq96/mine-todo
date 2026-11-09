package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"mine-todo/internal/config"
	"mine-todo/internal/store"
)

func newTestApp(t *testing.T) *App {
	t.Helper()
	base := t.TempDir()
	t.Setenv("APPDATA", base)
	t.Setenv("XDG_CONFIG_HOME", base)
	app, err := NewApp()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = app.storeManager.Close() })
	return app
}

func TestStorageSwitchFailurePreservesConfigAndDatabase(t *testing.T) {
	app := newTestApp(t)
	original := *app.configManager.Current()
	if _, err := app.CreateTodo(store.CreateTodoInput{Title: "original"}); err != nil {
		t.Fatal(err)
	}
	destination := t.TempDir()
	if err := os.WriteFile(filepath.Join(destination, "todo.db"), []byte("not a database"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := app.UpdateStorageDirectory(destination, false); err == nil {
		t.Fatal("expected failure")
	}
	if *app.configManager.Current() != original {
		t.Fatal("failed switch changed config")
	}
	todos, err := app.ListTodos()
	if err != nil || len(todos) != 1 {
		t.Fatalf("source data unavailable: %v", err)
	}
	restarted, err := NewApp()
	if err != nil {
		t.Fatalf("restart after failure: %v", err)
	}
	defer restarted.storeManager.Close()
	data, err := restarted.GetBootstrap()
	if err != nil || data.Todos[0].Title != "original" {
		t.Fatalf("restart lost source data: %v", err)
	}
}

func TestCopyRejectsExistingTargetAndCanOpenItExplicitly(t *testing.T) {
	app := newTestApp(t)
	original := *app.configManager.Current()
	if _, err := app.CreateTodo(store.CreateTodoInput{Title: "source"}); err != nil {
		t.Fatal(err)
	}
	destination := t.TempDir()
	target, err := store.NewManager(&config.AppConfig{StorageDir: destination, DBPath: filepath.Join(destination, "todo.db")})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := target.CreateTodo(store.CreateTodoInput{Title: "target"}); err != nil {
		t.Fatal(err)
	}
	_ = target.Close()
	if _, err := app.UpdateStorageDirectory(destination, true); err == nil || err.Error() != "target database already exists" {
		t.Fatalf("expected conflict, got %v", err)
	}
	if *app.configManager.Current() != original {
		t.Fatal("conflict changed config")
	}
	data, err := app.UpdateStorageDirectory(destination, false)
	if err != nil || len(data.Todos) != 1 || data.Todos[0].Title != "target" {
		t.Fatalf("explicit open failed: %v", err)
	}
	if _, err := app.UpdateTodo(store.UpdateTodoInput{DatabasePath: original.DBPath, ID: data.Todos[0].ID, Title: "stale source draft"}); err == nil || err.Error() != "database changed" {
		t.Fatalf("stale write was accepted: %v", err)
	}
	current, err := app.ListTodos()
	if err != nil || current[0].Title != "target" {
		t.Fatalf("stale write changed target: %v", err)
	}
}

func TestStorageCopyPreservesAllDataAndSamePathIsHarmless(t *testing.T) {
	app := newTestApp(t)
	note, err := app.CreateNote(store.CreateNoteInput{Title: "note", ContentMarkdown: "body"})
	if err != nil {
		t.Fatal(err)
	}
	todo, err := app.CreateTodo(store.CreateTodoInput{Title: "todo", NoteIDs: []string{note.ID}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.CreateTodoSubitem(store.CreateTodoSubitemInput{TodoID: todo.ID, Content: "subitem"}); err != nil {
		t.Fatal(err)
	}
	before, err := app.GetBootstrap()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.UpdateStorageDirectory(before.Config.StorageDir, true); err != nil {
		t.Fatal(err)
	}
	after, err := app.UpdateStorageDirectory(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	after.Config = before.Config
	want, _ := json.Marshal(before)
	got, _ := json.Marshal(after)
	if string(got) != string(want) {
		t.Fatalf("copy changed data: want %s, got %s", want, got)
	}
}
