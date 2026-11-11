package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"mine-todo/internal/config"
	"mine-todo/internal/notedoc"
	"mine-todo/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	mu                 sync.Mutex
	ctx                context.Context
	configManager      *config.Manager
	storeManager       *store.Manager
	frontendReady      bool
	closeApproved      bool
	openMarkdownDialog func(context.Context, runtime.OpenDialogOptions) (string, error)
	saveMarkdownDialog func(context.Context, runtime.SaveDialogOptions) (string, error)
}

func NewApp() (*App, error) {
	cfgManager, err := config.NewManager()
	if err != nil {
		return nil, err
	}

	storeManager, err := store.NewManager(cfgManager.Current())
	if err != nil {
		return nil, err
	}

	return &App{
		configManager: cfgManager,
		storeManager:  storeManager,
	}, nil
}

func (a *App) startup(ctx context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.ctx = ctx
}

func (a *App) beforeClose(_ context.Context) bool {
	a.mu.Lock()
	waitForSave := a.frontendReady && !a.closeApproved && a.ctx != nil
	ctx := a.ctx
	a.mu.Unlock()
	if waitForSave {
		runtime.EventsEmit(ctx, "app:close-requested")
	}
	return waitForSave
}

func (a *App) shutdown(_ context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	_ = a.storeManager.Close()
}

func (a *App) FrontendReady() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.frontendReady = true
}

func (a *App) ConfirmClose() error {
	a.mu.Lock()
	if a.ctx == nil {
		a.mu.Unlock()
		return errors.New("application context is unavailable")
	}
	a.closeApproved = true
	ctx := a.ctx
	a.mu.Unlock()
	runtime.Quit(ctx)
	return nil
}

func (a *App) GetBootstrap() (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.getBootstrap()
}

func (a *App) getBootstrap() (*BootstrapResponse, error) {
	groups, err := a.storeManager.ListGroups()
	if err != nil {
		return nil, err
	}

	todos, err := a.storeManager.ListTodos()
	if err != nil {
		return nil, err
	}

	notes, err := a.storeManager.ListNotes()
	if err != nil {
		return nil, err
	}

	trash, err := a.storeManager.ListTrash()
	if err != nil {
		return nil, err
	}

	cfg := a.configManager.Current()
	return &BootstrapResponse{
		Config: *cfg,
		Groups: groups,
		Todos:  todos,
		Notes:  notes,
		Trash:  *trash,
	}, nil
}

func (a *App) ListGroups() ([]store.Group, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.storeManager.ListGroups()
}

func (a *App) ListTodos() ([]store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.storeManager.ListTodos()
}

func (a *App) ListNotes() ([]store.Note, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.storeManager.ListNotes()
}

func (a *App) CreateNote(input store.CreateNoteInput) (*store.Note, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" {
		return nil, errors.New("note title is required")
	}
	return a.storeManager.CreateNote(input)
}

func (a *App) ImportNoteMarkdown(input store.ImportNoteMarkdownInput) (*store.Note, error) {
	input.DatabasePath = strings.TrimSpace(input.DatabasePath)
	a.mu.Lock()
	if input.DatabasePath == "" || input.DatabasePath != a.configManager.Current().DBPath {
		a.mu.Unlock()
		return nil, errors.New("database changed")
	}
	ctx, open := a.ctx, a.openMarkdownDialog
	a.mu.Unlock()
	if ctx == nil {
		return nil, errors.New("application context is unavailable")
	}
	if open == nil {
		open = runtime.OpenFileDialog
	}
	path, err := open(ctx, runtime.OpenDialogOptions{Filters: []runtime.FileFilter{{DisplayName: "Markdown (*.md, *.markdown)", Pattern: "*.md;*.markdown"}}})
	if err != nil {
		return nil, fmt.Errorf("select markdown file: %w", err)
	}
	if path == "" {
		return nil, nil
	}
	noteTitle, content, err := readMarkdownFile(path)
	if err != nil {
		return nil, err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if input.DatabasePath != a.configManager.Current().DBPath {
		return nil, errors.New("database changed")
	}
	return a.storeManager.CreateNote(store.CreateNoteInput{Title: noteTitle, ContentMarkdown: content})
}

func (a *App) ExportNoteMarkdown(input store.ExportNoteMarkdownInput) (bool, error) {
	input.ID = strings.TrimSpace(input.ID)
	input.DatabasePath = strings.TrimSpace(input.DatabasePath)
	if input.ID == "" {
		return false, errors.New("note id is required")
	}
	a.mu.Lock()
	if input.DatabasePath == "" || input.DatabasePath != a.configManager.Current().DBPath {
		a.mu.Unlock()
		return false, errors.New("database changed")
	}
	ctx, save := a.ctx, a.saveMarkdownDialog
	notes, err := a.storeManager.ListNotes()
	a.mu.Unlock()
	if err != nil {
		return false, err
	}
	var target *store.Note
	for i := range notes {
		if notes[i].ID == input.ID {
			target = &notes[i]
			break
		}
	}
	if target == nil {
		return false, errors.New("note not found")
	}
	if ctx == nil {
		return false, errors.New("application context is unavailable")
	}
	if save == nil {
		save = runtime.SaveFileDialog
	}
	path, err := save(ctx, runtime.SaveDialogOptions{DefaultFilename: markdownFilename(target.Title), CanCreateDirectories: true, Filters: []runtime.FileFilter{{DisplayName: "Markdown (*.md, *.markdown)", Pattern: "*.md;*.markdown"}}})
	if err != nil {
		return false, fmt.Errorf("select markdown destination: %w", err)
	}
	if path == "" {
		return false, nil
	}
	if !isMarkdownPath(path) {
		path += ".md"
	}
	if err := writeMarkdownFile(path, markdownExportContent(target.Title, target.ContentMarkdown)); err != nil {
		return false, err
	}
	return true, nil
}

func (a *App) ExportNoteDocument(input store.ExportNoteDocumentInput) (bool, error) {
	input.ID = strings.TrimSpace(input.ID)
	input.DatabasePath = strings.TrimSpace(input.DatabasePath)
	input.Format = strings.ToLower(strings.TrimSpace(input.Format))
	if input.ID == "" {
		return false, errors.New("note id is required")
	}
	var generate func(io.Writer, string, string) error
	var displayName string
	switch input.Format {
	case "docx":
		generate, displayName = notedoc.Word, "Word (*.docx)"
	case "pdf":
		generate, displayName = notedoc.PDF, "PDF (*.pdf)"
	default:
		return false, errors.New("unsupported document format")
	}
	a.mu.Lock()
	if input.DatabasePath == "" || input.DatabasePath != a.configManager.Current().DBPath {
		a.mu.Unlock()
		return false, errors.New("database changed")
	}
	ctx, save := a.ctx, a.saveMarkdownDialog
	notes, err := a.storeManager.ListNotes()
	a.mu.Unlock()
	if err != nil {
		return false, err
	}
	var target *store.Note
	for i := range notes {
		if notes[i].ID == input.ID {
			target = &notes[i]
			break
		}
	}
	if target == nil {
		return false, errors.New("note not found")
	}
	if ctx == nil {
		return false, errors.New("application context is unavailable")
	}
	if save == nil {
		save = runtime.SaveFileDialog
	}
	extension := "." + input.Format
	filename := strings.TrimSuffix(markdownFilename(target.Title), ".md") + extension
	path, err := save(ctx, runtime.SaveDialogOptions{DefaultFilename: filename, CanCreateDirectories: true, Filters: []runtime.FileFilter{{DisplayName: displayName, Pattern: "*" + extension}}})
	if err != nil {
		return false, fmt.Errorf("select document destination: %w", err)
	}
	if path == "" {
		return false, nil
	}
	if !strings.EqualFold(filepath.Ext(path), extension) {
		path += extension
	}
	if err := writeNoteDocument(path, func(w io.Writer) error { return generate(w, target.Title, target.ContentMarkdown) }); err != nil {
		return false, err
	}
	return true, nil
}

func (a *App) UpdateNote(input store.UpdateNoteInput) (*store.Note, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if input.DatabasePath != "" && input.DatabasePath != a.configManager.Current().DBPath {
		return nil, errors.New("database changed")
	}
	input.ID = strings.TrimSpace(input.ID)
	input.Title = strings.TrimSpace(input.Title)
	if input.ID == "" {
		return nil, errors.New("note id is required")
	}
	if input.Title == "" {
		return nil, errors.New("note title is required")
	}
	return a.storeManager.UpdateNote(input)
}

func (a *App) DeleteNote(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return errors.New("note id is required")
	}
	return a.storeManager.DeleteNote(id)
}

func (a *App) RestoreNote(id string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("note id is required")
	}
	if err := a.storeManager.RestoreNote(id); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) PurgeNote(id string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("note id is required")
	}
	if err := a.storeManager.PurgeNote(id); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) CreateTodo(input store.CreateTodoInput) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.GroupID = strings.TrimSpace(input.GroupID)
	input.Title = strings.TrimSpace(input.Title)
	input.DueDate = strings.TrimSpace(input.DueDate)
	if input.Title == "" {
		return nil, errors.New("title is required")
	}
	return a.storeManager.CreateTodo(input)
}

func (a *App) UpdateTodo(input store.UpdateTodoInput) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if input.DatabasePath != "" && input.DatabasePath != a.configManager.Current().DBPath {
		return nil, errors.New("database changed")
	}
	if strings.TrimSpace(input.ID) == "" {
		return nil, errors.New("todo id is required")
	}
	input.GroupID = strings.TrimSpace(input.GroupID)
	input.DueDate = strings.TrimSpace(input.DueDate)
	if strings.TrimSpace(input.Title) == "" {
		return nil, errors.New("title is required")
	}
	return a.storeManager.UpdateTodo(input)
}

func (a *App) CreateGroup(input store.CreateGroupInput) (*store.Group, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, errors.New("group name is required")
	}
	return a.storeManager.CreateGroup(input)
}

func (a *App) UpdateGroup(input store.UpdateGroupInput) (*store.Group, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.ID = strings.TrimSpace(input.ID)
	input.Name = strings.TrimSpace(input.Name)
	if input.ID == "" {
		return nil, errors.New("group id is required")
	}
	if input.Name == "" {
		return nil, errors.New("group name is required")
	}
	return a.storeManager.UpdateGroup(input)
}

func (a *App) DeleteGroup(input store.DeleteGroupInput) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.ID = strings.TrimSpace(input.ID)
	if input.ID == "" {
		return nil, errors.New("group id is required")
	}
	if err := a.storeManager.DeleteGroup(input); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) RestoreGroup(id string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("group id is required")
	}
	if err := a.storeManager.RestoreGroup(id); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) PurgeGroup(id string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("group id is required")
	}
	if err := a.storeManager.PurgeGroup(id); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) DeleteTodo(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if strings.TrimSpace(id) == "" {
		return errors.New("todo id is required")
	}
	return a.storeManager.DeleteTodo(id)
}

func (a *App) RestoreTodo(id string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("todo id is required")
	}
	if err := a.storeManager.RestoreTodo(id); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) PurgeTodo(id string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("todo id is required")
	}
	if err := a.storeManager.PurgeTodo(id); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) PurgeTrash() (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.storeManager.PurgeTrash(); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) ToggleTodoCompleted(id string) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("todo id is required")
	}
	return a.storeManager.ToggleTodoCompleted(id)
}

func (a *App) CreateTodoSubitem(input store.CreateTodoSubitemInput) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.TodoID = strings.TrimSpace(input.TodoID)
	input.Content = strings.TrimSpace(input.Content)
	if input.TodoID == "" {
		return nil, errors.New("todo id is required")
	}
	if input.Content == "" {
		return nil, errors.New("subitem content is required")
	}
	return a.storeManager.CreateTodoSubitem(input)
}

func (a *App) DeleteTodoSubitems(input store.DeleteTodoSubitemsInput) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.TodoID = strings.TrimSpace(input.TodoID)
	if input.TodoID == "" {
		return nil, errors.New("todo id is required")
	}
	if len(input.IDs) == 0 {
		return nil, errors.New("at least one subitem id is required")
	}
	return a.storeManager.DeleteTodoSubitems(input)
}

func (a *App) ToggleTodoSubitemCompleted(input store.ToggleTodoSubitemInput) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.TodoID = strings.TrimSpace(input.TodoID)
	input.ID = strings.TrimSpace(input.ID)
	if input.TodoID == "" {
		return nil, errors.New("todo id is required")
	}
	if input.ID == "" {
		return nil, errors.New("subitem id is required")
	}
	return a.storeManager.ToggleTodoSubitemCompleted(input)
}

func (a *App) UpdateTodoSubitem(input store.UpdateTodoSubitemInput) (*store.Todo, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	input.TodoID = strings.TrimSpace(input.TodoID)
	input.ID = strings.TrimSpace(input.ID)
	input.Content = strings.TrimSpace(input.Content)
	if input.TodoID == "" {
		return nil, errors.New("todo id is required")
	}
	if input.ID == "" {
		return nil, errors.New("subitem id is required")
	}
	if input.Content == "" {
		return nil, errors.New("subitem content is required")
	}
	return a.storeManager.UpdateTodoSubitem(input)
}

func (a *App) UpdateStorageDirectory(path string, copyData bool) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("storage directory is required")
	}

	cfg, err := a.configManager.PrepareStorageDir(path)
	if err != nil {
		return nil, err
	}
	current := a.configManager.Current()
	if source, err := os.Stat(current.DBPath); err == nil {
		if target, err := os.Stat(cfg.DBPath); err == nil && os.SameFile(source, target) {
			return a.getBootstrap()
		}
	}
	candidate, err := a.storeManager.PrepareSwitch(cfg, copyData)
	if err != nil {
		return nil, err
	}
	if err := a.configManager.CommitStorage(cfg); err != nil {
		_ = candidate.Close()
		return nil, err
	}
	previous := a.storeManager
	a.storeManager = candidate
	_ = previous.Close()
	return a.getBootstrap()
}

func (a *App) UpdateLanguage(language string) (*BootstrapResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if _, err := a.configManager.UpdateLanguage(language); err != nil {
		return nil, err
	}
	return a.getBootstrap()
}

func (a *App) SelectStorageDirectory() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.ctx == nil {
		return "", errors.New("application context is unavailable")
	}

	current := a.configManager.Current()
	selected, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Select Data Directory",
		DefaultDirectory: current.StorageDir,
	})
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(selected), nil
}

type BootstrapResponse struct {
	Config config.AppConfig `json:"config"`
	Groups []store.Group    `json:"groups"`
	Todos  []store.Todo     `json:"todos"`
	Notes  []store.Note     `json:"notes"`
	Trash  store.TrashData  `json:"trash"`
}
