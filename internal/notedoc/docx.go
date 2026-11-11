package notedoc

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

func escape(value string) string {
	var out bytes.Buffer
	_ = xml.EscapeText(&out, []byte(value))
	return out.String()
}

// Word writes a real OOXML document, without requiring Microsoft Word.
func Word(w io.Writer, title, markdown string) error {
	var body strings.Builder
	for _, b := range parse(title, markdown) {
		if b.kind == "table" {
			if len(b.rows) == 0 || len(b.rows[0]) == 0 {
				continue
			}
			width := 10080 / len(b.rows[0])
			body.WriteString(`<w:tbl><w:tblPr><w:tblW w:w="10080" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>`)
			for _, side := range []string{"top", "left", "bottom", "right", "insideH", "insideV"} {
				fmt.Fprintf(&body, `<w:%s w:val="single" w:sz="4" w:color="D9D9D9"/>`, side)
			}
			body.WriteString(`</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>`)
			for range b.rows[0] {
				fmt.Fprintf(&body, `<w:gridCol w:w="%d"/>`, width)
			}
			body.WriteString(`</w:tblGrid>`)
			for i, row := range b.rows {
				body.WriteString(`<w:tr><w:trPr>`)
				if i == 0 {
					body.WriteString(`<w:tblHeader/>`)
				}
				body.WriteString(`</w:trPr>`)
				for _, cell := range row {
					fmt.Fprintf(&body, `<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/><w:vAlign w:val="center"/>`, width)
					if i == 0 {
						body.WriteString(`<w:shd w:fill="F2F2F2"/>`)
					}
					body.WriteString(`</w:tcPr>`)
					writeParagraph(&body, block{kind: "paragraph", runs: cell})
					body.WriteString(`</w:tc>`)
				}
				body.WriteString(`</w:tr>`)
			}
			body.WriteString(`</w:tbl><w:p/>`)
		} else {
			writeParagraph(&body, b)
		}
	}
	files := []struct{ name, content string }{
		{"[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`},
		{"_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`},
		{"docProps/core.xml", `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>` + escape(title) + `</dc:title><dc:creator>Mine ToDo</dc:creator></cp:coreProperties>`},
		{"word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
		{"word/styles.xml", wordStyles()},
		{"word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` + body.String() + `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="360" w:footer="360"/></w:sectPr></w:body></w:document>`},
	}
	archive := zip.NewWriter(w)
	for _, file := range files {
		entry, err := archive.Create(file.name)
		if err != nil {
			return fmt.Errorf("create word part: %w", err)
		}
		if _, err := io.WriteString(entry, file.content); err != nil {
			return fmt.Errorf("write word part: %w", err)
		}
	}
	if err := archive.Close(); err != nil {
		return fmt.Errorf("close word archive: %w", err)
	}
	return nil
}

func writeParagraph(out *strings.Builder, b block) {
	style := "Normal"
	if b.kind == "title" {
		style = "Title"
	} else if b.kind == "heading" {
		style = fmt.Sprintf("Heading%d", b.level)
	} else if b.kind == "code" {
		style = "Code"
	}
	fmt.Fprintf(out, `<w:p><w:pPr><w:pStyle w:val="%s"/><w:widowControl/>`, style)
	if b.indent > 0 {
		fmt.Fprintf(out, `<w:ind w:left="%d"/>`, b.indent*360)
	}
	if b.kind == "rule" {
		out.WriteString(`<w:pBdr><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/></w:pBdr>`)
	}
	out.WriteString(`</w:pPr>`)
	for _, r := range b.runs {
		out.WriteString(`<w:r><w:rPr>`)
		if r.bold {
			out.WriteString(`<w:b/><w:bCs/>`)
		}
		if r.italic {
			out.WriteString(`<w:i/><w:iCs/>`)
		}
		if r.strike {
			out.WriteString(`<w:strike/>`)
		}
		if r.code {
			out.WriteString(`<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F4F4F4"/>`)
		}
		out.WriteString(`</w:rPr>`)
		for i, line := range strings.Split(r.text, "\n") {
			if i > 0 {
				out.WriteString(`<w:br/>`)
			}
			for j, part := range strings.Split(line, "\t") {
				if j > 0 {
					out.WriteString(`<w:tab/>`)
				}
				out.WriteString(`<w:t xml:space="preserve">` + escape(part) + `</w:t>`)
			}
		}
		out.WriteString(`</w:r>`)
	}
	out.WriteString(`</w:p>`)
}

func wordStyles() string {
	var out strings.Builder
	out.WriteString(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="300"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="000000"/></w:rPr></w:style>`)
	for level, size := range []int{40, 34, 28, 26, 24, 22} {
		fmt.Fprintf(&out, `<w:style w:type="paragraph" w:styleId="Heading%d"><w:name w:val="heading %d"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="260" w:after="120"/><w:outlineLvl w:val="%d"/></w:pPr><w:rPr><w:b/><w:sz w:val="%d"/><w:color w:val="000000"/></w:rPr></w:style>`, level+1, level+1, level, size)
	}
	out.WriteString(`<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style></w:styles>`)
	return out.String()
}
