package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	configDirName  = "mine-todo"
	configFileName = "config.json"
)

type AppConfig struct {
	StorageDir string `json:"storageDir"`
	DBPath     string `json:"dbPath"`
	Language   string `json:"language"`
}

type Manager struct {
	configFile string
	current    *AppConfig
}

func NewManager() (*Manager, error) {
	baseDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("resolve user config dir: %w", err)
	}

	configDir := filepath.Join(baseDir, configDirName)
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}

	manager := &Manager{
		configFile: filepath.Join(configDir, configFileName),
	}

	cfg, err := manager.loadOrCreate()
	if err != nil {
		return nil, err
	}
	manager.current = cfg

	return manager, nil
}

func (m *Manager) Current() *AppConfig {
	copyValue := *m.current
	return &copyValue
}

func (m *Manager) PrepareStorageDir(storageDir string) (*AppConfig, error) {
	if strings.TrimSpace(storageDir) == "" {
		return nil, fmt.Errorf("storage directory is empty")
	}
	storageDir, err := filepath.Abs(storageDir)
	if err != nil {
		return nil, fmt.Errorf("resolve storage directory: %w", err)
	}
	cfg := &AppConfig{
		StorageDir: storageDir,
		DBPath:     filepath.Join(storageDir, "todo.db"),
		Language:   normalizeLanguage(m.current.Language),
	}

	if err := ensureStorageDir(cfg.StorageDir); err != nil {
		return nil, err
	}
	return cfg, nil
}

// CommitStorage is called only after the target database is ready to use.
func (m *Manager) CommitStorage(cfg *AppConfig) error {
	if err := m.persist(cfg); err != nil {
		return err
	}
	copyValue := *cfg
	m.current = &copyValue
	return nil
}

func (m *Manager) UpdateLanguage(language string) (*AppConfig, error) {
	cfg := &AppConfig{
		StorageDir: m.current.StorageDir,
		DBPath:     m.current.DBPath,
		Language:   normalizeLanguage(language),
	}

	if err := m.persist(cfg); err != nil {
		return nil, err
	}

	m.current = cfg
	return m.Current(), nil
}

func (m *Manager) loadOrCreate() (*AppConfig, error) {
	content, err := os.ReadFile(m.configFile)
	if err == nil {
		var cfg AppConfig
		if err := json.Unmarshal(content, &cfg); err != nil {
			return nil, fmt.Errorf("parse config: %w", err)
		}
		cfg.Language = normalizeLanguage(cfg.Language)
		if err := ensureStorageDir(cfg.StorageDir); err != nil {
			return nil, err
		}
		return &cfg, nil
	}

	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read config: %w", err)
	}

	baseDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("resolve user config dir: %w", err)
	}

	defaultStorageDir := filepath.Join(baseDir, configDirName, "data")
	cfg := &AppConfig{
		StorageDir: defaultStorageDir,
		DBPath:     filepath.Join(defaultStorageDir, "todo.db"),
		Language:   defaultLanguage(),
	}
	if err := ensureStorageDir(cfg.StorageDir); err != nil {
		return nil, err
	}
	if err := m.persist(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (m *Manager) persist(cfg *AppConfig) error {
	content, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	temporary, err := os.CreateTemp(filepath.Dir(m.configFile), "config-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary config: %w", err)
	}
	defer os.Remove(temporary.Name())
	if err := temporary.Chmod(0o644); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("set config permissions: %w", err)
	}
	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write config: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("sync config: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close config: %w", err)
	}
	if err := os.Rename(temporary.Name(), m.configFile); err != nil {
		return fmt.Errorf("replace config: %w", err)
	}
	return nil
}

func ensureStorageDir(storageDir string) error {
	if storageDir == "" {
		return fmt.Errorf("storage directory is empty")
	}
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		return fmt.Errorf("create storage dir: %w", err)
	}
	return nil
}

func defaultLanguage() string {
	return "zh-CN"
}

func normalizeLanguage(language string) string {
	switch language {
	case "en", "en-US":
		return "en-US"
	case "zh", "zh-CN", "":
		return "zh-CN"
	default:
		return defaultLanguage()
	}
}
