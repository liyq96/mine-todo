// Package notedoc converts note Markdown into portable Word and PDF documents.
package notedoc

import (
	"bytes"
	"html"
	"strconv"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	east "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
	xhtml "golang.org/x/net/html"
)

type run struct {
	text                       string
	bold, italic, strike, code bool
}

type block struct {
	kind          string
	level, indent int
	runs          []run
	rows          [][][]run
}

func parse(title, markdown string) []block {
	source := []byte(strings.ReplaceAll(markdown, "\r\n", "\n"))
	root := goldmark.New(goldmark.WithExtensions(extension.GFM)).Parser().Parse(text.NewReader(source))
	blocks := []block{{kind: "title", runs: []run{{text: title}}}}
	var visit func(ast.Node, int)
	visit = func(node ast.Node, indent int) {
		switch n := node.(type) {
		case *ast.Heading:
			blocks = append(blocks, block{kind: "heading", level: n.Level, indent: indent, runs: inline(n, source, run{})})
		case *ast.Paragraph, *ast.TextBlock:
			blocks = append(blocks, block{kind: "paragraph", indent: indent, runs: inline(n, source, run{})})
		case *ast.FencedCodeBlock, *ast.CodeBlock:
			var content strings.Builder
			for i := 0; i < n.Lines().Len(); i++ {
				line := n.Lines().At(i)
				content.Write(line.Value(source))
			}
			blocks = append(blocks, block{kind: "code", indent: indent, runs: []run{{text: strings.TrimSuffix(content.String(), "\n"), code: true}}})
		case *ast.List:
			index := n.Start
			for item := n.FirstChild(); item != nil; item = item.NextSibling() {
				before := len(blocks)
				for child := item.FirstChild(); child != nil; child = child.NextSibling() {
					visit(child, indent+1)
				}
				if len(blocks) == before {
					blocks = append(blocks, block{kind: "paragraph", indent: indent + 1})
				}
				prefix := "• "
				if n.IsOrdered() {
					prefix = strconv.Itoa(index) + ". "
					index++
				}
				blocks[before].runs = append([]run{{text: prefix}}, blocks[before].runs...)
			}
		case *ast.Blockquote:
			for child := n.FirstChild(); child != nil; child = child.NextSibling() {
				visit(child, indent+1)
			}
		case *east.Table:
			b := block{kind: "table", indent: indent}
			for row := n.FirstChild(); row != nil; row = row.NextSibling() {
				cells := [][]run{}
				for cell := row.FirstChild(); cell != nil; cell = cell.NextSibling() {
					cells = append(cells, inline(cell, source, run{bold: row == n.FirstChild()}))
				}
				b.rows = append(b.rows, cells)
			}
			blocks = append(blocks, b)
		case *ast.ThematicBreak:
			blocks = append(blocks, block{kind: "rule"})
		case *ast.HTMLBlock:
			var raw bytes.Buffer
			for i := 0; i < n.Lines().Len(); i++ {
				line := n.Lines().At(i)
				raw.Write(line.Value(source))
			}
			if n.HasClosure() {
				raw.Write(n.ClosureLine.Value(source))
			}
			blocks = append(blocks, block{kind: "paragraph", indent: indent, runs: []run{{text: htmlText(raw.String())}}})
		default:
			for child := n.FirstChild(); child != nil; child = child.NextSibling() {
				visit(child, indent)
			}
		}
	}
	visit(root, 0)
	return blocks
}

func inline(node ast.Node, source []byte, style run) []run {
	var result []run
	for child := node.FirstChild(); child != nil; child = child.NextSibling() {
		r := style
		switch n := child.(type) {
		case *ast.Text:
			r.text = string(n.Segment.Value(source))
			if !n.IsRaw() {
				r.text = html.UnescapeString(string(util.UnescapePunctuations([]byte(r.text))))
			}
			if n.HardLineBreak() {
				r.text += "\n"
			} else if n.SoftLineBreak() {
				r.text += " "
			}
		case *ast.String:
			r.text = string(n.Value)
		case *ast.Emphasis:
			if n.Level == 2 {
				r.bold = true
			} else {
				r.italic = true
			}
			result = append(result, inline(n, source, r)...)
			continue
		case *east.Strikethrough:
			r.strike = true
			result = append(result, inline(n, source, r)...)
			continue
		case *ast.CodeSpan:
			r.code = true
			for c := n.FirstChild(); c != nil; c = c.NextSibling() {
				r.text += strings.ReplaceAll(string(c.Text(source)), "\n", " ")
			}
		case *ast.Link:
			result = append(result, inline(n, source, r)...)
			r.text = " (" + string(n.Destination) + ")"
		case *ast.AutoLink:
			r.text = string(n.Label(source))
		case *ast.Image:
			// Keep the description and source; exporting never fetches remote files.
			result = append(result, inline(n, source, r)...)
			r.text = " (" + string(n.Destination) + ")"
		case *east.TaskCheckBox:
			r.text = "[ ] "
			if n.IsChecked {
				r.text = "[x] "
			}
		case *ast.RawHTML:
			for i := 0; i < n.Segments.Len(); i++ {
				segment := n.Segments.At(i)
				tag := strings.ToLower(string(segment.Value(source)))
				if strings.HasPrefix(tag, "<br") {
					r.text += "\n"
				}
			}
		default:
			result = append(result, inline(n, source, r)...)
			continue
		}
		if r.text != "" {
			result = append(result, r)
		}
	}
	return result
}

func htmlText(value string) string {
	root, err := xhtml.Parse(strings.NewReader(value))
	if err != nil {
		return value
	}
	var out strings.Builder
	var walk func(*xhtml.Node)
	walk = func(n *xhtml.Node) {
		if n.Type == xhtml.ElementNode && (n.Data == "script" || n.Data == "style") {
			return
		}
		if n.Type == xhtml.TextNode {
			out.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if n.Type == xhtml.ElementNode && (n.Data == "br" || n.Data == "p" || n.Data == "div") {
			out.WriteByte('\n')
		}
	}
	walk(root)
	return strings.TrimSpace(out.String())
}
