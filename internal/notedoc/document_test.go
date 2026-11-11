package notedoc

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"io"
	"strings"
	"testing"

	"github.com/signintech/gopdf"
)

func TestWordKeepsTitleAndFormattedMarkdown(t *testing.T) {
	var result bytes.Buffer
	err := Word(&result, "独立标题 & <plain>", "## 正文标题\n\n**加粗** *斜体* ~~删除~~ `code`\n\n- [x] 已完成\n- [ ] 未完成\n\n| 名称 | 值 |\n| --- | --- |\n| 中文 | 保留 |\n\n```go\nfmt.Println(\"你好\")\n```\n\n> 引用\n\n[链接](https://example.com)\n")
	if err != nil {
		t.Fatal(err)
	}
	archive, err := zip.NewReader(bytes.NewReader(result.Bytes()), int64(result.Len()))
	if err != nil {
		t.Fatal(err)
	}
	var document string
	for _, file := range archive.File {
		r, err := file.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(r)
		r.Close()
		if err != nil {
			t.Fatal(err)
		}
		decoder := xml.NewDecoder(bytes.NewReader(data))
		for {
			if _, err := decoder.Token(); err == io.EOF {
				break
			} else if err != nil {
				t.Fatalf("invalid %s: %v", file.Name, err)
			}
		}
		if file.Name == "word/document.xml" {
			document = string(data)
		}
	}
	for _, part := range []string{"独立标题 &amp; &lt;plain&gt;", "正文标题", `w:val="Title"`, `w:val="Heading2"`, "<w:b/>", "<w:i/>", "<w:strike/>", "[x] ", "[ ] ", "<w:tbl>", "<w:tblHeader/>", "中文", "fmt.Println", "https://example.com"} {
		if !strings.Contains(document, part) {
			t.Errorf("missing content or formatting %q", part)
		}
	}
	if strings.Contains(document, "**加粗**") {
		t.Error("Markdown formatting was not converted")
	}
}

func TestPDFPaginationAndEmbeddedFonts(t *testing.T) {
	var result bytes.Buffer
	markdown := "## 小节\n\n**加粗中文**与正文\n\n" + strings.Repeat("中文段落与 long English words and https://example.com/very/long/link\n\n", 70) + "\n| 列一 | 列二 |\n| --- | --- |\n" + strings.Repeat("| 中文内容 | 保留全部行 |\n", 60)
	if err := PDF(&result, "中文导出标题", markdown); err != nil {
		t.Fatal(err)
	}
	data := result.String()
	for _, token := range []string{"%PDF-", "/FontFile2", "/ToUnicode", "%%EOF"} {
		if !strings.Contains(data, token) {
			t.Errorf("invalid PDF: missing %q", token)
		}
	}
	if strings.Count(data, "/Type /Page\n") < 2 && strings.Count(data, "/Type /Page ") < 2 {
		t.Error("long document did not paginate")
	}
}

func TestPDFWrapKeepsChineseClosingPunctuation(t *testing.T) {
	l := pdfLayout{}
	l.pdf.Start(gopdf.Config{PageSize: gopdf.Rect{W: pageWidth, H: pageHeight}})
	if err := l.pdf.AddTTFFontData("Noto", regularFont); err != nil {
		t.Fatal(err)
	}
	lines, err := l.wrap([]run{{text: "中文内容，后续。"}}, 22, 11)
	if err != nil {
		t.Fatal(err)
	}
	var all strings.Builder
	for _, line := range lines {
		var content strings.Builder
		for _, r := range line {
			content.WriteString(r.text)
		}
		if strings.HasPrefix(content.String(), "，") || strings.HasPrefix(content.String(), "。") {
			t.Fatalf("punctuation starts a line: %q", content.String())
		}
		all.WriteString(content.String())
	}
	if all.String() != "中文内容，后续。" {
		t.Fatalf("content changed: %q", all.String())
	}
}
