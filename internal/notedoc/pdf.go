package notedoc

import (
	_ "embed"
	"fmt"
	"io"
	"math"
	"strings"
	"unicode"

	"github.com/signintech/gopdf"
)

// Embed freely redistributable CJK fonts so exported files work offline.
//
//go:embed fonts/NotoSansSC-Regular.ttf
var regularFont []byte

//go:embed fonts/NotoSansSC-Bold.ttf
var boldFont []byte

//go:embed fonts/OFL.txt
var fontLicense string

const pageWidth, pageHeight, margin = 612.0, 792.0, 54.0

type pdfLine []run
type pdfLayout struct {
	pdf gopdf.GoPdf
	y   float64
}

// PDF writes a paginated PDF with an embedded, subsetted Chinese font.
func PDF(w io.Writer, title, markdown string) error {
	l := pdfLayout{y: margin}
	l.pdf.Start(gopdf.Config{PageSize: gopdf.Rect{W: pageWidth, H: pageHeight}})
	if err := l.pdf.AddTTFFontDataWithOption("Noto", regularFont, gopdf.TtfOption{OnGlyphNotFoundSubstitute: func(r rune) rune { return '?' }}); err != nil {
		return fmt.Errorf("load pdf font: %w", err)
	}
	if err := l.pdf.AddTTFFontDataWithOption("Noto", boldFont, gopdf.TtfOption{Style: gopdf.Bold, OnGlyphNotFoundSubstitute: func(r rune) rune { return '?' }}); err != nil {
		return fmt.Errorf("load bold pdf font: %w", err)
	}
	l.pdf.SetInfo(gopdf.PdfInfo{Title: title, Creator: "Mine ToDo", Subject: "Noto Sans SC font license:\n" + fontLicense})
	l.pdf.AddPage()
	for _, b := range parse(title, markdown) {
		if b.kind == "table" {
			if err := l.table(b); err != nil {
				return err
			}
			continue
		}
		if b.kind == "rule" {
			l.ensure(18)
			l.pdf.SetStrokeColor(210, 210, 210)
			l.pdf.Line(margin, l.y+7, pageWidth-margin, l.y+7)
			l.y += 18
			continue
		}
		size, before, after := 11.0, 0.0, 9.0
		bold := false
		if b.kind == "title" {
			size, after, bold = 24, 18, true
		}
		if b.kind == "heading" {
			size = []float64{20, 17, 14, 13, 12, 11}[b.level-1]
			before, after, bold = 12, 6, true
		}
		if b.kind == "code" {
			size = 10
		}
		runs := append([]run(nil), b.runs...)
		for i := range runs {
			runs[i].bold = runs[i].bold || bold
		}
		indent := math.Min(float64(b.indent)*18, 144)
		lines, err := l.wrap(runs, pageWidth-2*margin-indent, size)
		if err != nil {
			return err
		}
		lineHeight := size * 1.65
		keep := lineHeight
		if b.kind == "title" || b.kind == "heading" {
			keep = float64(len(lines))*lineHeight + 32
		}
		l.ensure(math.Min(keep+before, pageHeight-2*margin))
		if l.y > margin {
			l.y += before
		}
		for _, line := range lines {
			l.ensure(lineHeight)
			if err := l.draw(line, margin+indent, l.y, size, lineHeight); err != nil {
				return err
			}
			l.y += lineHeight
		}
		l.y += after
	}
	if _, err := l.pdf.WriteTo(w); err != nil {
		return fmt.Errorf("write pdf: %w", err)
	}
	return nil
}

func (l *pdfLayout) ensure(height float64) {
	if l.y+height > pageHeight-margin {
		l.pdf.AddPage()
		l.y = margin
	}
}

func (l *pdfLayout) font(r run, size float64) error {
	style := ""
	if r.bold {
		style = "B"
	}
	return l.pdf.SetFont("Noto", style, size)
}

// Wrap at words where possible, and at characters for Chinese or long URLs.
func (l *pdfLayout) wrap(runs []run, width, size float64) ([]pdfLine, error) {
	lines := []pdfLine{{}}
	used := 0.0
	for _, r := range runs {
		if err := l.font(r, size); err != nil {
			return nil, err
		}
		value := []rune(strings.ReplaceAll(r.text, "\t", "    "))
		for i := 0; i < len(value); {
			if value[i] == '\n' {
				lines = append(lines, pdfLine{})
				used = 0
				i++
				continue
			}
			end := i + 1
			if value[i] < 128 && !unicode.IsSpace(value[i]) {
				for end < len(value) && value[end] < 128 && !unicode.IsSpace(value[end]) {
					end++
				}
			}
			// Keep closing punctuation with the preceding character, and opening
			// punctuation with the next one, when wrapping Chinese paragraphs.
			if !r.code {
				if strings.ContainsRune("（［｛《〈「『【〔“‘", value[i]) && end < len(value) && value[end] != '\n' {
					end++
				}
				for end < len(value) && strings.ContainsRune("，。！？、；：）］｝》〉」』】〕”’…,.!?;:)]}", value[end]) {
					end++
				}
			}
			word := string(value[i:end])
			w, err := l.pdf.MeasureTextWidth(word)
			if err != nil {
				return nil, err
			}
			if w <= width && used+w > width && used > 0 {
				lines = append(lines, pdfLine{})
				used = 0
			}
			for _, char := range value[i:end] {
				cw, err := l.pdf.MeasureTextWidth(string(char))
				if err != nil {
					return nil, err
				}
				if used+cw > width && used > 0 {
					lines = append(lines, pdfLine{})
					used = 0
				}
				if used == 0 && char == ' ' && r.text != " " && !r.code {
					continue
				}
				line := &lines[len(lines)-1]
				piece := r
				piece.text = string(char)
				if len(*line) > 0 {
					last := &(*line)[len(*line)-1]
					if last.bold == r.bold && last.italic == r.italic && last.strike == r.strike && last.code == r.code {
						last.text += piece.text
					} else {
						*line = append(*line, piece)
					}
				} else {
					*line = append(*line, piece)
				}
				used += cw
			}
			i = end
		}
	}
	return lines, nil
}

func (l *pdfLayout) draw(line pdfLine, x, y, size, height float64) error {
	for _, r := range line {
		if err := l.font(r, size); err != nil {
			return err
		}
		w, err := l.pdf.MeasureTextWidth(r.text)
		if err != nil {
			return err
		}
		l.pdf.SetXY(x, y)
		l.pdf.SetTextColor(0, 0, 0)
		if err := l.pdf.CellWithOption(&gopdf.Rect{W: w, H: height}, r.text, gopdf.CellOption{Align: gopdf.Left | gopdf.Middle}); err != nil {
			return err
		}
		if r.strike {
			l.pdf.SetStrokeColor(0, 0, 0)
			l.pdf.Line(x, y+height*0.55, x+w, y+height*0.55)
		}
		x += w
	}
	return nil
}

func (l *pdfLayout) table(b block) error {
	if len(b.rows) == 0 || len(b.rows[0]) == 0 {
		return nil
	}
	const size, lineHeight, padding = 10.0, 16.5, 6.0
	colWidth := (pageWidth - 2*margin) / float64(len(b.rows[0]))
	var header [][]pdfLine
	headerCount := 1
	newPage := func(repeatHeader bool) error {
		l.pdf.AddPage()
		l.y = margin
		if repeatHeader && float64(headerCount)*lineHeight+4*padding+lineHeight < pageHeight-2*margin {
			return l.tableSegment(header, 0, headerCount, colWidth, true)
		}
		return nil
	}
	for rowIndex, row := range b.rows {
		cells := make([][]pdfLine, len(row))
		count := 1
		for i, cell := range row {
			lines, err := l.wrap(cell, colWidth-2*padding, size)
			if err != nil {
				return err
			}
			cells[i] = lines
			if len(lines) > count {
				count = len(lines)
			}
		}
		if rowIndex == 0 {
			header = cells
			headerCount = count
		}
		rowHeight := float64(count)*lineHeight + 2*padding
		availablePage := pageHeight - 2*margin
		if rowIndex > 0 {
			availablePage -= float64(headerCount)*lineHeight + 2*padding
		}
		// Move a normal row intact; split only rows taller than a whole page.
		if rowHeight <= availablePage && l.y+rowHeight > pageHeight-margin {
			if err := newPage(rowIndex > 0); err != nil {
				return err
			}
		}
		for start := 0; start < count; {
			if l.y+lineHeight+2*padding > pageHeight-margin {
				if err := newPage(rowIndex > 0); err != nil {
					return err
				}
			}
			available := int((pageHeight - margin - l.y - 2*padding) / lineHeight)
			if available < 1 {
				l.pdf.AddPage()
				l.y = margin
				continue
			}
			take := count - start
			if take > available {
				take = available
			}
			if err := l.tableSegment(cells, start, take, colWidth, rowIndex == 0); err != nil {
				return err
			}
			start += take
		}
	}
	l.y += 10
	return nil
}

func (l *pdfLayout) tableSegment(cells [][]pdfLine, start, count int, width float64, header bool) error {
	height := float64(count)*16.5 + 12
	for i, cell := range cells {
		x := margin + float64(i)*width
		if header {
			l.pdf.SetFillColor(242, 242, 242)
			l.pdf.RectFromUpperLeftWithStyle(x, l.y, width, height, "F")
		}
		l.pdf.SetStrokeColor(217, 217, 217)
		l.pdf.SetLineWidth(0.5)
		l.pdf.RectFromUpperLeft(x, l.y, width, height)
		for j := start; j < start+count && j < len(cell); j++ {
			if err := l.draw(cell[j], x+6, l.y+6+float64(j-start)*16.5, 10, 16.5); err != nil {
				return err
			}
		}
	}
	l.y += height
	return nil
}
