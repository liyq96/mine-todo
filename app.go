package main

import (
	"context"
	"errors"
	"strings"

	"mine-todo/internal/config"
	"mine-todo/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	configManager *config.Manager
	storeManager  *store.Manager
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
	a.ctx = ctx
}

func (a *App) beforeClose(_ context.Context) bool {
	_ = a.storeManager.Close()
	return false
}

func (a *App) GetBootstrap() (*BootstrapResponse, error) {
	todos, err := a.storeManager.ListTodos()
	if err != nil {
		return nil, err
	}

	cfg := a.configManager.Current()
	return &BootstrapResponse{
		Config: *cfg,
		Todos:  todos,
	}, nil
}

func (a *App) ListTodos() ([]store.Todo, error) {
	return a.storeManager.ListTodos()
}

func (a *App) CreateTodo(input store.CreateTodoInput) (*store.Todo, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.DueDate = strings.TrimSpace(input.DueDate)
	if input.Title == "" {
		return nil, errors.New("title is required")
	}
	return a.storeManager.CreateTodo(input)
}

func (a *App) UpdateTodo(input store.UpdateTodoInput) (*store.Todo, error) {
	if strings.TrimSpace(input.ID) == "" {
		return nil, errors.New("todo id is required")
	}
	input.DueDate = strings.TrimSpace(input.DueDate)
	if strings.TrimSpace(input.Title) == "" {
		return nil, errors.New("title is required")
	}
	return a.storeManager.UpdateTodo(input)
}

func (a *App) DeleteTodo(id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("todo id is required")
	}
	return a.storeManager.DeleteTodo(id)
}

func (a *App) ToggleTodoCompleted(id string) (*store.Todo, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("todo id is required")
	}
	return a.storeManager.ToggleTodoCompleted(id)
}

func (a *App) CreateTodoSubitem(input store.CreateTodoSubitemInput) (*store.Todo, error) {
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
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("storage directory is required")
	}

	cfg, err := a.configManager.UpdateStorageDir(path, copyData)
	if err != nil {
		return nil, err
	}

	if err := a.storeManager.Switch(cfg); err != nil {
		return nil, err
	}

	todos, err := a.storeManager.ListTodos()
	if err != nil {
		return nil, err
	}

	return &BootstrapResponse{
		Config: *cfg,
		Todos:  todos,
	}, nil
}

func (a *App) UpdateLanguage(language string) (*BootstrapResponse, error) {
	cfg, err := a.configManager.UpdateLanguage(language)
	if err != nil {
		return nil, err
	}

	todos, err := a.storeManager.ListTodos()
	if err != nil {
		return nil, err
	}

	return &BootstrapResponse{
		Config: *cfg,
		Todos:  todos,
	}, nil
}

func (a *App) SelectStorageDirectory() (string, error) {
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
	Todos  []store.Todo     `json:"todos"`
}
