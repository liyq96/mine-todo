package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

type NoteLink struct {
	Label  string `json:"label"`
	NoteID string `json:"noteId"`
}

var noteLinkPattern = regexp.MustCompile(`\[\[[^\r\n]*?\]{2,}`)

func decodeNoteLinks(value string) ([]NoteLink, error) {
	links := make([]NoteLink, 0)
	if value != "" {
		if err := json.Unmarshal([]byte(value), &links); err != nil {
			return nil, fmt.Errorf("decode internal note links: %w", err)
		}
	}
	return links, nil
}

func refreshNoteBindings(tx *sql.Tx, id, content string) error {
	var stored string
	if err := tx.QueryRow(`SELECT internal_links_json FROM notes WHERE id = ?`, id).Scan(&stored); err != nil {
		return fmt.Errorf("query note link bindings: %w", err)
	}
	targets, err := loadNoteLinkTargets(tx)
	if err != nil {
		return err
	}
	return storeNoteBindings(tx, id, content, stored, targets)
}

func loadNoteLinkTargets(tx *sql.Tx) (map[string][]string, error) {
	rows, err := tx.Query(`SELECT id, title FROM notes WHERE is_trashed = 0`)
	if err != nil {
		return nil, fmt.Errorf("query note link targets: %w", err)
	}
	targets := make(map[string][]string)
	for rows.Next() {
		var targetID, title string
		if err := rows.Scan(&targetID, &title); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scan note link target: %w", err)
		}
		key := strings.ToLower(strings.TrimSpace(title))
		targets[key] = append(targets[key], targetID)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, fmt.Errorf("iterate note link targets: %w", err)
	}
	_ = rows.Close()
	return targets, nil
}

func storeNoteBindings(tx *sql.Tx, id, content, stored string, targets map[string][]string) error {
	existing, err := decodeNoteLinks(stored)
	if err != nil {
		return err
	}
	bound := make(map[string]string)
	for _, link := range existing {
		bound[strings.ToLower(link.Label)] = link.NoteID
	}
	links := make([]NoteLink, 0)
	seen := make(map[string]bool)
	for _, match := range noteLinkPattern.FindAllString(content, -1) {
		label := strings.TrimSpace(match[2 : len(match)-2])
		key := strings.ToLower(label)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		targetID := bound[key]
		if targetID == "" && len(targets[key]) == 1 {
			targetID = targets[key][0]
		}
		if targetID != "" {
			links = append(links, NoteLink{Label: label, NoteID: targetID})
		}
	}
	encoded, err := json.Marshal(links)
	if err != nil {
		return fmt.Errorf("encode note link bindings: %w", err)
	}
	if string(encoded) == stored {
		return nil
	}
	if _, err := tx.Exec(`UPDATE notes SET internal_links_json = ? WHERE id = ?`, string(encoded), id); err != nil {
		return fmt.Errorf("save note link bindings: %w", err)
	}
	return nil
}

// Resolve legacy or previously unresolved title references before a rename.
// Existing bindings retain their target IDs, including soft-deleted targets.
func bindAllNoteReferences(tx *sql.Tx) error {
	rows, err := tx.Query(`SELECT id, content_markdown, internal_links_json FROM notes WHERE instr(content_markdown, '[[') > 0`)
	if err != nil {
		return fmt.Errorf("query unresolved note references: %w", err)
	}
	type source struct{ id, content, stored string }
	sources := make([]source, 0)
	for rows.Next() {
		var item source
		if err := rows.Scan(&item.id, &item.content, &item.stored); err != nil {
			_ = rows.Close()
			return fmt.Errorf("scan note reference source: %w", err)
		}
		sources = append(sources, item)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("iterate note reference sources: %w", err)
	}
	_ = rows.Close()
	if len(sources) == 0 {
		return nil
	}
	targets, err := loadNoteLinkTargets(tx)
	if err != nil {
		return err
	}
	for _, item := range sources {
		if err := storeNoteBindings(tx, item.id, item.content, item.stored, targets); err != nil {
			return err
		}
	}
	return nil
}

func initializeNoteBindings(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin migrate note links tx: %w", err)
	}
	defer tx.Rollback()
	if err := bindAllNoteReferences(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migrate note links tx: %w", err)
	}
	return nil
}
