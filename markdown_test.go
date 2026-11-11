package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"mine-todo/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestMarkdownImportExportAndCancellation(t *testing.T) {
	app := newTestApp(t)
	app.startup(context.Background())
	database := app.configManager.Current().DBPath
	input := store.ImportNoteMarkdownInput{DatabasePath: database}
	app.openMarkdownDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) { return "", nil }
	if note, err := app.ImportNoteMarkdown(input); err != nil || note != nil {
		t.Fatalf("cancel import: %v, %v", note, err)
	}
	path := filepath.Join(t.TempDir(), "中文笔记.MD")
	content := "# 标题\n\n- [ ] 待办\n\n```go\nfmt.Println(1)\n```\n"
	if err := os.WriteFile(path, []byte("\ufeff"+content), 0o644); err != nil {
		t.Fatal(err)
	}
	app.openMarkdownDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) { return path, nil }
	note, err := app.ImportNoteMarkdown(input)
	if err != nil {
		t.Fatal(err)
	}
	if note.Title != "中文笔记" || note.ContentMarkdown != content {
		t.Fatalf("unexpected imported content: %#v", note)
	}
	duplicate, err := app.ImportNoteMarkdown(input)
	if err != nil || duplicate.ID == note.ID || duplicate.Title != note.Title {
		t.Fatalf("same-name import did not create a new note: %v", err)
	}
	export := store.ExportNoteMarkdownInput{DatabasePath: database, ID: note.ID}
	app.saveMarkdownDialog = func(context.Context, runtime.SaveDialogOptions) (string, error) { return "", nil }
	if saved, err := app.ExportNoteMarkdown(export); err != nil || saved {
		t.Fatalf("cancel export: %v, %v", saved, err)
	}
	destination := filepath.Join(t.TempDir(), "导出")
	app.saveMarkdownDialog = func(_ context.Context, options runtime.SaveDialogOptions) (string, error) {
		if options.DefaultFilename != "中文笔记.md" {
			t.Fatalf("unexpected filename: %q", options.DefaultFilename)
		}
		return destination, nil
	}
	if saved, err := app.ExportNoteMarkdown(export); err != nil || !saved {
		t.Fatalf("export: %v, %v", saved, err)
	}
	data, err := os.ReadFile(destination + ".md")
	expected := "# 中文笔记\n\n" + content
	if err != nil || string(data) != expected {
		t.Fatalf("export did not include title and body: %q, %v", data, err)
	}
	app.openMarkdownDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) { return destination + ".md", nil }
	reimported, err := app.ImportNoteMarkdown(input)
	if err != nil || reimported.ContentMarkdown != expected || reimported.Title != "导出" {
		t.Fatalf("reimport did not retain the heading as body: %#v, %v", reimported, err)
	}
	if err := writeMarkdownFile(destination+".md", "replacement"); err != nil {
		t.Fatal(err)
	}
	data, err = os.ReadFile(destination + ".md")
	if err != nil || string(data) != "replacement" {
		t.Fatalf("replace export failed: %q, %v", data, err)
	}
}

func TestMarkdownImportKeepsAllFormatsInBody(t *testing.T) {
	for _, content := range []string{
		"# 文内标题\n\n正文\n",
		"---\ntitle: 元数据标题\ntags: [work]\n---\n\n# 正文标题\n",
		"文内标题\n========\n\n正文\n",
		"```yaml\ntitle: code\n```\n\n- [x] 完成\n\n> 引用\n",
	} {
		path := filepath.Join(t.TempDir(), "文件名.md")
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		title, body, err := readMarkdownFile(path)
		if err != nil || title != "文件名" || body != content {
			t.Fatalf("import interpreted or removed content: title=%q body=%q err=%v", title, body, err)
		}
	}
}

func TestMarkdownExportKeepsPlainTitleAndOriginalBody(t *testing.T) {
	body := "# 正文自己的标题\n\n**正文格式**\n"
	if actual := markdownExportContent("独立标题", body); actual != "# 独立标题\n\n"+body {
		t.Fatalf("unexpected export: %q", actual)
	}
	if actual := markdownExportContent("**标题**\n# 第二行", ""); actual != "# \\*\\*标题\\*\\* \\# 第二行\n\n" {
		t.Fatalf("plain title was interpreted as Markdown: %q", actual)
	}
}

func TestMarkdownImportRejectsInvalidFilesAndDatabaseChanges(t *testing.T) {
	app := newTestApp(t)
	app.startup(context.Background())
	input := store.ImportNoteMarkdownInput{DatabasePath: app.configManager.Current().DBPath}
	for _, test := range []struct {
		name string
		data []byte
	}{
		{"invalid.txt", []byte("body")},
		{"invalid.md", []byte{0xff, 0xfe, 0x61}},
		{"large.md", []byte(strings.Repeat("a", maxMarkdownBytes+1))},
	} {
		path := filepath.Join(t.TempDir(), test.name)
		if err := os.WriteFile(path, test.data, 0o644); err != nil {
			t.Fatal(err)
		}
		app.openMarkdownDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) { return path, nil }
		if _, err := app.ImportNoteMarkdown(input); err == nil {
			t.Fatalf("accepted invalid file: %s", test.name)
		}
	}
	path := filepath.Join(t.TempDir(), "valid.markdown")
	if err := os.WriteFile(path, []byte("valid"), 0o644); err != nil {
		t.Fatal(err)
	}
	app.openMarkdownDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) {
		if _, err := app.UpdateStorageDirectory(t.TempDir(), false); err != nil {
			t.Fatal(err)
		}
		return path, nil
	}
	if _, err := app.ImportNoteMarkdown(input); err == nil || err.Error() != "database changed" {
		t.Fatalf("stale import: %v", err)
	}
	notes, err := app.ListNotes()
	if err != nil || len(notes) != 0 {
		t.Fatalf("invalid import changed database: %v", err)
	}
	if _, err := app.ExportNoteMarkdown(store.ExportNoteMarkdownInput{ID: "old", DatabasePath: input.DatabasePath}); err == nil {
		t.Fatal("accepted stale export")
	}
}

func TestMarkdownFilenamesAndWriteFailures(t *testing.T) {
	for title, expected := range map[string]string{"CON": "_CON.md", "a/b:c*?": "a_b_c__.md", "  ... ": "note.md", "中文": "中文.md"} {
		if actual := markdownFilename(title); actual != expected {
			t.Errorf("filename %q: got %q, want %q", title, actual, expected)
		}
	}
	if err := writeMarkdownFile(filepath.Join(t.TempDir(), "missing", "export.md"), "body"); err == nil {
		t.Fatal("ignored export write failure")
	}
}
