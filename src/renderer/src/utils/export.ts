import { saveAs } from 'file-saver'

// Convert markdown to simple HTML for DOCX
function markdownToHtml(markdown: string): string {
  return markdown
    .split('\n')
    .map(line => {
      // Headings
      if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`
      if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`
      if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`

      // Bold
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

      // Italic
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>')

      // Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return `<li>${line.substring(2)}</li>`
      }

      // Paragraphs
      if (line.trim()) return `<p>${line}</p>`

      return ''
    })
    .join('\n')
}

// Create a simple DOCX-like HTML document
function createDocxHtml(title: string, content: string): string {
  const html = markdownToHtml(content)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
    }
    h1 { font-size: 24pt; margin-top: 24pt; margin-bottom: 12pt; }
    h2 { font-size: 18pt; margin-top: 18pt; margin-bottom: 9pt; }
    h3 { font-size: 14pt; margin-top: 14pt; margin-bottom: 7pt; }
    p { margin-bottom: 10pt; text-align: justify; }
    li { margin-bottom: 6pt; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${html}
</body>
</html>`
}

// Export single chapter as Markdown
export function exportChapterAsMarkdown(chapterTitle: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const filename = `${sanitizeFilename(chapterTitle)}.md`
  saveAs(blob, filename)
}

// Export single chapter as DOCX (HTML format for Word compatibility)
export function exportChapterAsDocx(chapterTitle: string, content: string): void {
  const html = createDocxHtml(chapterTitle, content)
  const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const filename = `${sanitizeFilename(chapterTitle)}.doc`
  saveAs(blob, filename)
}

// Export full book as Markdown
export function exportBookAsMarkdown(
  bookTitle: string,
  chapters: Array<{ title: string; content: string; chapter_number: number }>
): void {
  let markdown = `# ${bookTitle}\n\n`

  // Sort chapters by number
  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number)

  for (const chapter of sortedChapters) {
    markdown += `\n\n---\n\n`
    markdown += `# Chapter ${chapter.chapter_number}: ${chapter.title}\n\n`
    markdown += chapter.content
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const filename = `${sanitizeFilename(bookTitle)}.md`
  saveAs(blob, filename)
}

// Export full book as DOCX (HTML format for Word compatibility)
export function exportBookAsDocx(
  bookTitle: string,
  chapters: Array<{ title: string; content: string; chapter_number: number }>
): void {
  let bookContent = ''

  // Sort chapters by number
  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number)

  for (const chapter of sortedChapters) {
    bookContent += `\n\n<div style="page-break-before: always;"></div>\n\n`
    bookContent += `# Chapter ${chapter.chapter_number}: ${chapter.title}\n\n`
    bookContent += chapter.content
  }

  const html = createDocxHtml(bookTitle, bookContent)
  const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const filename = `${sanitizeFilename(bookTitle)}.doc`
  saveAs(blob, filename)
}

// Sanitize filename to remove invalid characters
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
}
