package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mine-todo/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestNoteDocumentExport(t *testing.T) {
	app := newTestApp(t)
	app.startup(context.Background())
	note, err := app.CreateNote(store.CreateNoteInput{Title: "中文标题", ContentMarkdown: "## 小节\n\n**中文正文**"})
	if err != nil {
		t.Fatal(err)
	}
	for _, format := range []string{"docx", "pdf"} {
		t.Run(format, func(t *testing.T) {
			input := store.ExportNoteDocumentInput{DatabasePath: app.configManager.Current().DBPath, ID: note.ID, Format: format}
			app.saveMarkdownDialog = func(context.Context, runtime.SaveDialogOptions) (string, error) { return "", nil }
			if saved, err := app.ExportNoteDocument(input); err != nil || saved {
				t.Fatalf("cancel: %v %v", saved, err)
			}
			path := filepath.Join(t.TempDir(), "document")
			app.saveMarkdownDialog = func(_ context.Context, opts runtime.SaveDialogOptions) (string, error) {
				if opts.DefaultFilename != "中文标题."+format || len(opts.Filters) != 1 || opts.Filters[0].Pattern != "*."+format {
					t.Fatalf("unexpected save options: %#v", opts)
				}
				return path, nil
			}
			if saved, err := app.ExportNoteDocument(input); err != nil || !saved {
				t.Fatalf("export: %v %v", saved, err)
			}
			data, err := os.ReadFile(path + "." + format)
			if err != nil {
				t.Fatal(err)
			}
			magic := "PK"
			if format == "pdf" {
				magic = "%PDF-"
			}
			if !bytes.HasPrefix(data, []byte(magic)) {
				t.Fatalf("invalid %s file", format)
			}
			// An existing destination is replaced only by a complete valid file.
			if saved, err := app.ExportNoteDocument(input); err != nil || !saved {
				t.Fatalf("overwrite: %v %v", saved, err)
			}
			input.DatabasePath = "old database"
			if _, err := app.ExportNoteDocument(input); err == nil || !strings.Contains(err.Error(), "database changed") {
				t.Fatalf("stale database: %v", err)
			}
		})
	}
	if _, err := app.ExportNoteDocument(store.ExportNoteDocumentInput{ID: note.ID, Format: "html"}); err == nil || err.Error() != "unsupported document format" {
		t.Fatalf("unexpected format validation: %v", err)
	}
}

func TestNoteDocumentFailedGenerationPreservesDestination(t *testing.T) {
	path := filepath.Join(t.TempDir(), "existing.docx")
	if err := os.WriteFile(path, []byte("original"), 0o644); err != nil {
		t.Fatal(err)
	}
	err := writeNoteDocument(path, func(w io.Writer) error {
		_, _ = io.WriteString(w, "incomplete")
		return errors.New("generation failed")
	})
	if err == nil {
		t.Fatal("expected error")
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "original" {
		t.Fatalf("destination changed: %q %v", data, err)
	}
	files, err := os.ReadDir(filepath.Dir(path))
	if err != nil || len(files) != 1 {
		t.Fatalf("temporary export leaked: %v %v", files, err)
	}
}
