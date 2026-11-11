package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"
)

const maxMarkdownBytes = 16 * 1024 * 1024

func isMarkdownPath(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".md" || ext == ".markdown"
}

func readMarkdownFile(path string) (string, string, error) {
	if !isMarkdownPath(path) {
		return "", "", errors.New("unsupported markdown extension")
	}
	file, err := os.Open(path)
	if err != nil {
		return "", "", fmt.Errorf("open markdown file: %w", err)
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxMarkdownBytes+1))
	if err != nil {
		return "", "", fmt.Errorf("read markdown file: %w", err)
	}
	if len(data) > maxMarkdownBytes {
		return "", "", errors.New("markdown file exceeds 16 mb")
	}
	content := strings.TrimPrefix(string(data), "\ufeff")
	if !utf8.ValidString(content) {
		return "", "", errors.New("markdown file must be utf-8")
	}
	title := strings.TrimSpace(strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)))
	if title == "" {
		title = "note"
	}
	return title, content, nil
}

func markdownFilename(title string) string {
	name := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || strings.ContainsRune(`<>:"/\|?*`, r) {
			return '_'
		}
		return r
	}, title)
	chars := []rune(name)
	if len(chars) > 100 {
		name = string(chars[:100])
	}
	name = strings.Trim(name, " .")
	if name == "" {
		name = "note"
	}
	base := strings.ToUpper(strings.SplitN(name, ".", 2)[0])
	if base == "CON" || base == "PRN" || base == "AUX" || base == "NUL" ||
		(len(base) == 4 && (strings.HasPrefix(base, "COM") || strings.HasPrefix(base, "LPT")) && base[3] >= '1' && base[3] <= '9') {
		name = "_" + name
	}
	return name + ".md"
}

func markdownExportContent(title, content string) string {
	title = strings.ReplaceAll(strings.ReplaceAll(title, "\r\n", " "), "\r", " ")
	title = strings.TrimSpace(strings.ReplaceAll(title, "\n", " "))
	// The note title is plain text, even when it contains Markdown punctuation.
	title = strings.NewReplacer(
		`\`, `\\`, "`", "\\`", "*", `\*`, "_", `\_`, "~", `\~`,
		"[", `\[`, "]", `\]`, "<", `\<`, ">", `\>`, "#", `\#`, "&", `\&`,
	).Replace(title)
	return "# " + title + "\n\n" + content
}

func writeMarkdownFile(path, content string) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".mine-todo-markdown-*.tmp")
	if err != nil {
		return fmt.Errorf("create markdown export: %w", err)
	}
	defer os.Remove(file.Name())
	defer file.Close()
	if err := file.Chmod(0o644); err != nil {
		return fmt.Errorf("set markdown permissions: %w", err)
	}
	if _, err := io.WriteString(file, content); err != nil {
		return fmt.Errorf("write markdown export: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync markdown export: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close markdown export: %w", err)
	}
	if err := os.Rename(file.Name(), path); err != nil {
		return fmt.Errorf("commit markdown export: %w", err)
	}
	return nil
}
