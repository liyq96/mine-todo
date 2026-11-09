package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestFailedConfigCommitPreservesPreviousConfig(t *testing.T) {
	base := t.TempDir()
	t.Setenv("APPDATA", base)
	t.Setenv("XDG_CONFIG_HOME", base)
	manager, err := NewManager()
	if err != nil {
		t.Fatal(err)
	}
	before := *manager.Current()
	originalPath := manager.configFile
	manager.configFile = t.TempDir() // replacing a directory must fail on every OS
	if _, err := manager.UpdateLanguage("en-US"); err == nil {
		t.Fatal("expected write failure")
	}
	if *manager.Current() != before {
		t.Fatal("failed commit changed in-memory config")
	}
	content, err := os.ReadFile(originalPath)
	if err != nil {
		t.Fatal(err)
	}
	var persisted AppConfig
	if err := json.Unmarshal(content, &persisted); err != nil {
		t.Fatal(err)
	}
	if persisted != before {
		t.Fatal("previous config was changed")
	}
	manager.configFile = originalPath
	if _, err := manager.UpdateLanguage("en-US"); err != nil {
		t.Fatal(err)
	}
	leftovers, err := filepath.Glob(filepath.Join(filepath.Dir(originalPath), "config-*.tmp"))
	if err != nil || len(leftovers) != 0 {
		t.Fatalf("temporary config files left over: %v", leftovers)
	}
}
