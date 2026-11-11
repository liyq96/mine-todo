package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Generate beside the destination and replace it only after a complete write.
func writeNoteDocument(path string, generate func(io.Writer) error) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".mine-todo-document-*.tmp")
	if err != nil {
		return fmt.Errorf("create document export: %w", err)
	}
	defer os.Remove(file.Name())
	defer file.Close()
	if err := file.Chmod(0o644); err != nil {
		return fmt.Errorf("set document permissions: %w", err)
	}
	if err := generate(file); err != nil {
		return fmt.Errorf("generate document: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync document export: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close document export: %w", err)
	}
	if err := os.Rename(file.Name(), path); err != nil {
		return fmt.Errorf("commit document export: %w", err)
	}
	return nil
}
