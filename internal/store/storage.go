package store

import (
	"errors"
	"fmt"
	"io"
	"os"

	"mine-todo/internal/config"
)

// PrepareSwitch leaves the active connection untouched. Callers serialize it
// with writes and commit the configuration only after the candidate is valid.
func (m *Manager) PrepareSwitch(cfg *config.AppConfig, copyData bool) (*Manager, error) {
	if copyData {
		if _, err := os.Stat(cfg.DBPath); err == nil {
			return nil, errors.New("target database already exists")
		} else if !os.IsNotExist(err) {
			return nil, fmt.Errorf("check target database: %w", err)
		}
		if err := m.copySnapshot(cfg); err != nil {
			return nil, err
		}
	}
	candidate, err := NewManager(cfg)
	if err != nil {
		return nil, err
	}
	var integrity string
	if err := candidate.db.QueryRow(`PRAGMA quick_check`).Scan(&integrity); err != nil || integrity != "ok" {
		_ = candidate.Close()
		if err != nil {
			return nil, fmt.Errorf("check target database integrity: %w", err)
		}
		return nil, errors.New("target database integrity check failed")
	}
	return candidate, nil
}

func (m *Manager) copySnapshot(cfg *config.AppConfig) error {
	snapshot, err := os.CreateTemp(cfg.StorageDir, "mine-todo-snapshot-*.tmp")
	if err != nil {
		return fmt.Errorf("create database snapshot: %w", err)
	}
	defer os.Remove(snapshot.Name())
	if err := snapshot.Close(); err != nil {
		return fmt.Errorf("close database snapshot: %w", err)
	}
	// VACUUM INTO accepts an empty destination and takes a consistent snapshot,
	// including committed WAL data, without copying a live database file.
	if _, err := m.db.Exec(`VACUUM main INTO ?`, snapshot.Name()); err != nil {
		return fmt.Errorf("snapshot database: %w", err)
	}
	source, err := os.Open(snapshot.Name())
	if err != nil {
		return fmt.Errorf("read database snapshot: %w", err)
	}
	defer source.Close()
	target, err := os.OpenFile(cfg.DBPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		if os.IsExist(err) {
			return errors.New("target database already exists")
		}
		return fmt.Errorf("create target database: %w", err)
	}
	complete := false
	defer func() {
		_ = target.Close()
		if !complete {
			_ = os.Remove(cfg.DBPath)
		}
	}()
	if _, err := io.Copy(target, source); err != nil {
		return fmt.Errorf("copy database snapshot: %w", err)
	}
	if err := target.Sync(); err != nil {
		return fmt.Errorf("sync target database: %w", err)
	}
	if err := target.Close(); err != nil {
		return fmt.Errorf("close target database: %w", err)
	}
	complete = true
	return nil
}
