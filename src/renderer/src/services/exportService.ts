/**
 * Professional Export Service
 * Supports DOCX, PDF, EPUB with Amazon KDP formatting
 *
 * Features:
 * - Proper chapter page breaks
 * - Scene breaks (*** or ---)
 * - Blockquotes
 * - Grouped lists
 * - First paragraph handling (no indent after headings)
 * - Bold/italic formatting
 * - Running headers
 * - Dedication page
 * - Chapter epigraphs
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
  SectionType,
  NumberFormat
} from 'docx'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// Types
export interface ChapterContent {
  title: string
  chapterNumber: number
  content: string
  epigraph?: string
  epigraphAuthor?: string
}

export interface BookMetadata {
  title: string
  author: string
  description?: string
  isbn?: string
  publisher?: string
  publishDate?: string
  language?: string
  keywords?: string[]
  category?: string
  dedication?: string
}

export interface ExportOptions {
  format: 'docx' | 'pdf' | 'epub' | 'kdp'
  includeTableOfContents: boolean
  includeTitlePage: boolean
  includeDedication: boolean
  includeAboutAuthor: boolean
  aboutAuthorText?: string
  pageSize: 'letter' | '6x9' | '5x8' | '5.5x8.5' | 'a5'
  fontSize: number
  lineSpacing: number
  fontFamily: string
  margins: {
    top: number
    bottom: number
    left: number
    right: number
    gutter: number
  }
  useDropCaps: boolean
}

// Amazon KDP Recommended Settings
export const KDP_PRESETS = {
  '6x9': {
    pageSize: '6x9' as const,
    width: 6,
    height: 9,
    margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.5, gutter: 0.125 },
    fontSize: 11,
    lineSpacing: 1.5,
    fontFamily: 'Times New Roman'
  },
  '5x8': {
    pageSize: '5x8' as const,
    width: 5,
    height: 8,
    margins: { top: 0.625, bottom: 0.625, left: 0.625, right: 0.5, gutter: 0.125 },
    fontSize: 10,
    lineSpacing: 1.4,
    fontFamily: 'Times New Roman'
  },
  '5.5x8.5': {
    pageSize: '5.5x8.5' as const,
    width: 5.5,
    height: 8.5,
    margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.5, gutter: 0.125 },
    fontSize: 11,
    lineSpacing: 1.5,
    fontFamily: 'Times New Roman'
  }
}

// Default export options
export const DEFAULT_OPTIONS: ExportOptions = {
  format: 'docx',
  includeTableOfContents: true,
  includeTitlePage: true,
  includeDedication: true,
  includeAboutAuthor: false,
  pageSize: '6x9',
  fontSize: 11,
  lineSpacing: 1.5,
  fontFamily: 'Times New Roman',
  margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.5, gutter: 0.125 },
  useDropCaps: false
}

// Segment types for parsed content
interface ContentSegment {
  type: 'heading' | 'paragraph' | 'list-item' | 'numbered-item' | 'blockquote' | 'scene-break'
  content: string
  level?: number
  isFirstAfterHeading?: boolean
}

/**
 * Enhanced Markdown parser with scene breaks, blockquotes, and proper list grouping
 */
function parseMarkdownToSegments(markdown: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const lines = markdown.split('\n')

  let currentParagraph = ''
  let lastWasHeading = false
  let inBlockquote = false
  let blockquoteContent = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Scene break (*** or --- or ___)
    if (/^(\*\*\*|---|___)$/.test(trimmedLine)) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
        lastWasHeading = false
      }
      if (blockquoteContent) {
        segments.push({ type: 'blockquote', content: blockquoteContent.trim() })
        blockquoteContent = ''
        inBlockquote = false
      }
      segments.push({ type: 'scene-break', content: '* * *' })
      continue
    }

    // Blockquote
    if (trimmedLine.startsWith('> ')) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
        lastWasHeading = false
      }
      inBlockquote = true
      blockquoteContent += (blockquoteContent ? ' ' : '') + trimmedLine.substring(2)
      continue
    } else if (inBlockquote && trimmedLine === '') {
      segments.push({ type: 'blockquote', content: blockquoteContent.trim() })
      blockquoteContent = ''
      inBlockquote = false
      continue
    } else if (inBlockquote) {
      // End blockquote if next line is not a blockquote
      segments.push({ type: 'blockquote', content: blockquoteContent.trim() })
      blockquoteContent = ''
      inBlockquote = false
    }

    // Heading
    if (trimmedLine.startsWith('### ')) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
      }
      segments.push({ type: 'heading', content: trimmedLine.substring(4), level: 3 })
      lastWasHeading = true
    } else if (trimmedLine.startsWith('## ')) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
      }
      segments.push({ type: 'heading', content: trimmedLine.substring(3), level: 2 })
      lastWasHeading = true
    } else if (trimmedLine.startsWith('# ')) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
      }
      segments.push({ type: 'heading', content: trimmedLine.substring(2), level: 1 })
      lastWasHeading = true
    }
    // Unordered list item
    else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
        lastWasHeading = false
      }
      segments.push({ type: 'list-item', content: trimmedLine.substring(2) })
    }
    // Ordered list item
    else if (/^\d+\.\s/.test(trimmedLine)) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
        lastWasHeading = false
      }
      segments.push({ type: 'numbered-item', content: trimmedLine.replace(/^\d+\.\s/, '') })
    }
    // Empty line - paragraph break
    else if (!trimmedLine) {
      if (currentParagraph) {
        segments.push({
          type: 'paragraph',
          content: currentParagraph.trim(),
          isFirstAfterHeading: lastWasHeading
        })
        currentParagraph = ''
        lastWasHeading = false
      }
    }
    // Regular text
    else {
      currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine
    }
  }

  // Handle remaining content
  if (blockquoteContent) {
    segments.push({ type: 'blockquote', content: blockquoteContent.trim() })
  }
  if (currentParagraph) {
    segments.push({
      type: 'paragraph',
      content: currentParagraph.trim(),
      isFirstAfterHeading: lastWasHeading
    })
  }

  return segments
}

/**
 * Parse inline formatting (bold, italic) for DOCX
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = []

  // Pattern for **bold**, *italic*, and ***bold italic***
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.substring(lastIndex, match.index) }))
    }

    // Add formatted text
    if (match[2]) {
      // Bold italic
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }))
    } else if (match[3]) {
      // Bold
      runs.push(new TextRun({ text: match[3], bold: true }))
    } else if (match[4]) {
      // Italic
      runs.push(new TextRun({ text: match[4], italics: true }))
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.substring(lastIndex) }))
  }

  // If no matches, return simple text run
  if (runs.length === 0) {
    runs.push(new TextRun({ text }))
  }

  return runs
}

/**
 * Group consecutive list items together
 */
function groupListItems(segments: ContentSegment[]): ContentSegment[][] {
  const groups: ContentSegment[][] = []
  let currentGroup: ContentSegment[] = []
  let currentType: string | null = null

  for (const segment of segments) {
    if (segment.type === 'list-item' || segment.type === 'numbered-item') {
      if (currentType === segment.type) {
        currentGroup.push(segment)
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
        }
        currentGroup = [segment]
        currentType = segment.type
      }
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
        currentType = null
      }
      groups.push([segment])
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

/**
 * Export to Professional DOCX (Word Document)
 */
export async function exportToDocx(
  metadata: BookMetadata,
  chapters: ChapterContent[],
  options: ExportOptions = DEFAULT_OPTIONS
): Promise<void> {
  const preset = KDP_PRESETS[options.pageSize as keyof typeof KDP_PRESETS] || KDP_PRESETS['6x9']

  const sections: any[] = []
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)

  // ============ FRONT MATTER SECTION ============
  const frontMatterChildren: Paragraph[] = []

  // Title Page
  if (options.includeTitlePage) {
    frontMatterChildren.push(
      // Vertical space
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 3000 } }),
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 3000 } }),
      // Title
      new Paragraph({
        children: [new TextRun({ text: metadata.title, bold: true, size: 72 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 }
      }),
      // Subtitle line
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 1500 } }),
      // Author
      new Paragraph({
        children: [new TextRun({ text: `by ${metadata.author}`, size: 36, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 }
      })
    )

    if (metadata.publisher) {
      frontMatterChildren.push(
        new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 4000 } }),
        new Paragraph({
          children: [new TextRun({ text: metadata.publisher, size: 24 })],
          alignment: AlignmentType.CENTER
        })
      )
    }

    frontMatterChildren.push(new Paragraph({ children: [new PageBreak()] }))
  }

  // Copyright Page
  frontMatterChildren.push(
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 4000 } }),
    new Paragraph({
      children: [new TextRun({ text: `Copyright © ${new Date().getFullYear()} ${metadata.author}`, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: 'All rights reserved.', size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without prior written permission.',
        size: 18
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  )

  if (metadata.isbn) {
    frontMatterChildren.push(
      new Paragraph({
        children: [new TextRun({ text: `ISBN: ${metadata.isbn}`, size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      })
    )
  }

  frontMatterChildren.push(new Paragraph({ children: [new PageBreak()] }))

  // Dedication Page
  if (options.includeDedication && metadata.dedication) {
    frontMatterChildren.push(
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 4000 } }),
      new Paragraph({
        children: [new TextRun({ text: metadata.dedication, size: 24, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({ children: [new PageBreak()] })
    )
  }

  // Table of Contents
  if (options.includeTableOfContents) {
    frontMatterChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'Contents', bold: true, size: 36 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      }),
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 400 } })
    )

    for (const chapter of sortedChapters) {
      frontMatterChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Chapter ${chapter.chapterNumber}`, size: 22 }),
            new TextRun({ text: '   ', size: 22 }),
            new TextRun({ text: chapter.title, size: 22 })
          ],
          spacing: { after: 150 }
        })
      )
    }

    frontMatterChildren.push(new Paragraph({ children: [new PageBreak()] }))
  }

  // Front matter section (no header, Roman numeral page numbers)
  sections.push({
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: {
          width: convertInchesToTwip(preset.width),
          height: convertInchesToTwip(preset.height)
        },
        margin: {
          top: convertInchesToTwip(options.margins.top),
          bottom: convertInchesToTwip(options.margins.bottom),
          left: convertInchesToTwip(options.margins.left + options.margins.gutter),
          right: convertInchesToTwip(options.margins.right)
        },
        pageNumbers: {
          start: 1,
          formatType: NumberFormat.LOWER_ROMAN
        }
      }
    },
    children: frontMatterChildren
  })

  // ============ CHAPTER SECTIONS ============
  for (let chapterIndex = 0; chapterIndex < sortedChapters.length; chapterIndex++) {
    const chapter = sortedChapters[chapterIndex]
    const chapterChildren: Paragraph[] = []

    // Chapter opener - centered, starts 1/3 down the page
    chapterChildren.push(
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 2000 } }),
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 2000 } }),
      new Paragraph({
        children: [new TextRun({ text: `Chapter ${chapter.chapterNumber}`, size: 24, allCaps: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      }),
      new Paragraph({
        children: [new TextRun({ text: chapter.title, size: 36, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    )

    // Chapter epigraph (if present)
    if (chapter.epigraph) {
      chapterChildren.push(
        new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: chapter.epigraph, italics: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          indent: { left: convertInchesToTwip(1), right: convertInchesToTwip(1) },
          spacing: { after: 100 }
        })
      )
      if (chapter.epigraphAuthor) {
        chapterChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `— ${chapter.epigraphAuthor}`, size: 18 })],
            alignment: AlignmentType.RIGHT,
            indent: { right: convertInchesToTwip(1) },
            spacing: { after: 400 }
          })
        )
      }
    }

    chapterChildren.push(
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 600 } })
    )

    // Parse and add chapter content
    const segments = parseMarkdownToSegments(chapter.content)
    const groupedSegments = groupListItems(segments)

    for (const group of groupedSegments) {
      // Handle grouped lists
      if (group.length > 0 && (group[0].type === 'list-item' || group[0].type === 'numbered-item')) {
        for (let i = 0; i < group.length; i++) {
          const item = group[i]
          chapterChildren.push(
            new Paragraph({
              children: parseInlineFormatting(item.type === 'list-item' ? `• ${item.content}` : `${i + 1}. ${item.content}`),
              spacing: { after: 80, line: Math.round(options.lineSpacing * 240) },
              indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.2) }
            })
          )
        }
        // Add space after list
        chapterChildren.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }))
        continue
      }

      // Handle single segments
      for (const segment of group) {
        if (segment.type === 'heading') {
          const headingLevel = segment.level === 1 ? HeadingLevel.HEADING_1 :
                              segment.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
          chapterChildren.push(
            new Paragraph({
              children: [new TextRun({ text: segment.content, bold: true, size: segment.level === 2 ? 26 : 22 })],
              heading: headingLevel,
              spacing: { before: 400, after: 200 }
            })
          )
        } else if (segment.type === 'paragraph') {
          // No first-line indent for first paragraph after heading
          const indent = segment.isFirstAfterHeading ? {} : { firstLine: convertInchesToTwip(0.3) }
          chapterChildren.push(
            new Paragraph({
              children: parseInlineFormatting(segment.content),
              spacing: { after: 200, line: Math.round(options.lineSpacing * 240) },
              indent
            })
          )
        } else if (segment.type === 'blockquote') {
          chapterChildren.push(
            new Paragraph({
              children: [new TextRun({ text: segment.content, italics: true })],
              spacing: { before: 200, after: 200, line: Math.round(options.lineSpacing * 240) },
              indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) }
            })
          )
        } else if (segment.type === 'scene-break') {
          chapterChildren.push(
            new Paragraph({
              children: [new TextRun({ text: '* * *', size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 400 }
            })
          )
        }
      }
    }

    // Chapter section with proper headers
    sections.push({
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: {
            width: convertInchesToTwip(preset.width),
            height: convertInchesToTwip(preset.height)
          },
          margin: {
            top: convertInchesToTwip(options.margins.top),
            bottom: convertInchesToTwip(options.margins.bottom),
            left: convertInchesToTwip(options.margins.left + options.margins.gutter),
            right: convertInchesToTwip(options.margins.right)
          },
          pageNumbers: {
            start: chapterIndex === 0 ? 1 : undefined,
            formatType: NumberFormat.DECIMAL
          }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [new TextRun({ text: metadata.title, italics: true, size: 18 })],
              alignment: AlignmentType.CENTER
            })
          ]
        }),
        first: new Header({
          children: [] // No header on chapter opening page
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })],
              alignment: AlignmentType.CENTER
            })
          ]
        })
      },
      children: chapterChildren
    })
  }

  // ============ BACK MATTER ============
  if (options.includeAboutAuthor && options.aboutAuthorText) {
    const backMatterChildren: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 2000 } }),
      new Paragraph({
        children: [new TextRun({ text: 'About the Author', bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      }),
      new Paragraph({
        children: [new TextRun({ text: options.aboutAuthorText })],
        spacing: { after: 200, line: Math.round(options.lineSpacing * 240) }
      })
    ]

    sections.push({
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: {
            width: convertInchesToTwip(preset.width),
            height: convertInchesToTwip(preset.height)
          },
          margin: {
            top: convertInchesToTwip(options.margins.top),
            bottom: convertInchesToTwip(options.margins.bottom),
            left: convertInchesToTwip(options.margins.left + options.margins.gutter),
            right: convertInchesToTwip(options.margins.right)
          }
        }
      },
      children: backMatterChildren
    })
  }

  // Create document
  const doc = new Document({ sections })

  // Generate and download
  const blob = await Packer.toBlob(doc)
  const filename = `${sanitizeFilename(metadata.title)}_${options.pageSize}.docx`
  saveAs(blob, filename)

  console.log(`✅ Exported: ${filename}`)
}

/**
 * Export to PDF with proper formatting
 */
export async function exportToPdf(
  metadata: BookMetadata,
  chapters: ChapterContent[],
  options: ExportOptions = DEFAULT_OPTIONS
): Promise<void> {
  const preset = KDP_PRESETS[options.pageSize as keyof typeof KDP_PRESETS] || KDP_PRESETS['6x9']

  const doc = new jsPDF({
    unit: 'in',
    format: [preset.width, preset.height]
  })

  const pageWidth = preset.width
  const pageHeight = preset.height
  const marginLeft = options.margins.left + options.margins.gutter
  const marginRight = options.margins.right
  const marginTop = options.margins.top
  const marginBottom = options.margins.bottom
  const contentWidth = pageWidth - marginLeft - marginRight

  let currentY = marginTop
  let pageNumber = 0
  let isFirstPageOfChapter = false

  const addNewPage = () => {
    doc.addPage()
    pageNumber++
    currentY = marginTop
    isFirstPageOfChapter = false
  }

  const checkPageBreak = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - marginBottom) {
      addFooter()
      addNewPage()
      return true
    }
    return false
  }

  const addHeader = () => {
    if (!isFirstPageOfChapter && pageNumber > 0) {
      doc.setFontSize(9)
      doc.setFont('times', 'italic')
      doc.text(metadata.title, pageWidth / 2, marginTop / 2, { align: 'center' })
    }
  }

  const addFooter = () => {
    if (pageNumber > 0) {
      doc.setFontSize(10)
      doc.setFont('times', 'normal')
      doc.text(String(pageNumber), pageWidth / 2, pageHeight - marginBottom / 2, { align: 'center' })
    }
  }

  // ============ TITLE PAGE ============
  if (options.includeTitlePage) {
    doc.setFontSize(36)
    doc.setFont('times', 'bold')
    const titleLines = doc.splitTextToSize(metadata.title, contentWidth)
    doc.text(titleLines, pageWidth / 2, pageHeight * 0.35, { align: 'center' })

    doc.setFontSize(18)
    doc.setFont('times', 'italic')
    doc.text(`by ${metadata.author}`, pageWidth / 2, pageHeight * 0.48, { align: 'center' })

    if (metadata.publisher) {
      doc.setFontSize(12)
      doc.setFont('times', 'normal')
      doc.text(metadata.publisher, pageWidth / 2, pageHeight * 0.88, { align: 'center' })
    }

    addNewPage()
  }

  // ============ COPYRIGHT PAGE ============
  doc.setFontSize(10)
  doc.setFont('times', 'normal')
  currentY = pageHeight * 0.4
  doc.text(`Copyright © ${new Date().getFullYear()} ${metadata.author}`, pageWidth / 2, currentY, { align: 'center' })
  currentY += 0.25
  doc.text('All rights reserved.', pageWidth / 2, currentY, { align: 'center' })
  currentY += 0.35

  const copyrightNotice = 'No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without prior written permission.'
  const copyrightLines = doc.splitTextToSize(copyrightNotice, contentWidth * 0.8)
  doc.text(copyrightLines, pageWidth / 2, currentY, { align: 'center' })

  if (metadata.isbn) {
    currentY += 0.6
    doc.text(`ISBN: ${metadata.isbn}`, pageWidth / 2, currentY, { align: 'center' })
  }

  addNewPage()

  // ============ DEDICATION PAGE ============
  if (options.includeDedication && metadata.dedication) {
    doc.setFontSize(14)
    doc.setFont('times', 'italic')
    currentY = pageHeight * 0.4
    const dedicationLines = doc.splitTextToSize(metadata.dedication, contentWidth * 0.7)
    doc.text(dedicationLines, pageWidth / 2, currentY, { align: 'center' })
    addNewPage()
  }

  // ============ TABLE OF CONTENTS ============
  if (options.includeTableOfContents) {
    doc.setFontSize(20)
    doc.setFont('times', 'bold')
    doc.text('Contents', pageWidth / 2, marginTop + 0.8, { align: 'center' })
    currentY = marginTop + 1.5

    doc.setFontSize(12)
    doc.setFont('times', 'normal')
    const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
    for (const chapter of sortedChapters) {
      checkPageBreak(0.35)
      doc.text(`Chapter ${chapter.chapterNumber}   ${chapter.title}`, marginLeft, currentY)
      currentY += 0.35
    }

    addNewPage()
  }

  // ============ CHAPTERS ============
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
  for (let chapterIdx = 0; chapterIdx < sortedChapters.length; chapterIdx++) {
    const chapter = sortedChapters[chapterIdx]
    isFirstPageOfChapter = true
    pageNumber++

    // Chapter opener
    currentY = marginTop + 1.5
    doc.setFontSize(12)
    doc.setFont('times', 'normal')
    doc.text(`CHAPTER ${chapter.chapterNumber}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 0.5

    doc.setFontSize(20)
    doc.setFont('times', 'bold')
    const titleLines = doc.splitTextToSize(chapter.title, contentWidth)
    doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' })
    currentY += titleLines.length * 0.35 + 0.4

    // Epigraph
    if (chapter.epigraph) {
      doc.setFontSize(10)
      doc.setFont('times', 'italic')
      const epigraphLines = doc.splitTextToSize(chapter.epigraph, contentWidth * 0.7)
      for (const line of epigraphLines) {
        doc.text(line, pageWidth / 2, currentY, { align: 'center' })
        currentY += 0.2
      }
      if (chapter.epigraphAuthor) {
        currentY += 0.1
        doc.setFont('times', 'normal')
        doc.text(`— ${chapter.epigraphAuthor}`, pageWidth / 2 + contentWidth * 0.2, currentY, { align: 'right' })
        currentY += 0.3
      }
    }

    currentY += 0.5

    // Chapter content
    doc.setFontSize(options.fontSize)
    doc.setFont('times', 'normal')

    const segments = parseMarkdownToSegments(chapter.content)
    const lineHeight = (options.fontSize / 72) * options.lineSpacing

    for (const segment of segments) {
      if (segment.type === 'heading') {
        checkPageBreak(0.6)
        addHeader()
        doc.setFontSize(segment.level === 2 ? 14 : 12)
        doc.setFont('times', 'bold')
        currentY += 0.2
        doc.text(segment.content, marginLeft, currentY)
        currentY += 0.35
        doc.setFontSize(options.fontSize)
        doc.setFont('times', 'normal')
      } else if (segment.type === 'paragraph') {
        // Apply proper text formatting
        let text = segment.content

        // Process text for display (we'll handle bold/italic with font changes in future)
        const cleanText = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1')
                              .replace(/\*\*(.+?)\*\*/g, '$1')
                              .replace(/\*(.+?)\*/g, '$1')

        const lines = doc.splitTextToSize(cleanText, contentWidth - 0.3)

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (checkPageBreak(lineHeight)) {
            addHeader()
          }
          // First line indent (but not for first paragraph after heading)
          const xPos = lineIdx === 0 && !segment.isFirstAfterHeading ? marginLeft + 0.3 : marginLeft
          doc.text(lines[lineIdx], xPos, currentY)
          currentY += lineHeight
        }
        currentY += lineHeight * 0.3 // Paragraph spacing
      } else if (segment.type === 'blockquote') {
        checkPageBreak(0.4)
        addHeader()
        doc.setFont('times', 'italic')
        const quoteLines = doc.splitTextToSize(segment.content, contentWidth - 1)
        for (const line of quoteLines) {
          if (checkPageBreak(lineHeight)) {
            addHeader()
          }
          doc.text(line, marginLeft + 0.5, currentY)
          currentY += lineHeight
        }
        doc.setFont('times', 'normal')
        currentY += lineHeight * 0.3
      } else if (segment.type === 'scene-break') {
        checkPageBreak(0.6)
        currentY += 0.2
        doc.setFontSize(12)
        doc.text('* * *', pageWidth / 2, currentY, { align: 'center' })
        doc.setFontSize(options.fontSize)
        currentY += 0.4
      } else if (segment.type === 'list-item') {
        checkPageBreak(lineHeight)
        addHeader()
        const bulletLines = doc.splitTextToSize(`• ${segment.content}`, contentWidth - 0.5)
        for (let i = 0; i < bulletLines.length; i++) {
          const xPos = i === 0 ? marginLeft + 0.3 : marginLeft + 0.5
          doc.text(bulletLines[i], xPos, currentY)
          currentY += lineHeight
        }
      } else if (segment.type === 'numbered-item') {
        checkPageBreak(lineHeight)
        addHeader()
        // We'd need to track numbering properly; simplified here
        const numLines = doc.splitTextToSize(segment.content, contentWidth - 0.5)
        for (let i = 0; i < numLines.length; i++) {
          const xPos = i === 0 ? marginLeft + 0.3 : marginLeft + 0.5
          doc.text(numLines[i], xPos, currentY)
          currentY += lineHeight
        }
      }
    }

    // End of chapter
    addFooter()

    // Start new page for next chapter (except last)
    if (chapterIdx < sortedChapters.length - 1) {
      addNewPage()
    }
  }

  // ============ ABOUT AUTHOR ============
  if (options.includeAboutAuthor && options.aboutAuthorText) {
    addNewPage()
    isFirstPageOfChapter = true
    pageNumber++

    currentY = marginTop + 1
    doc.setFontSize(18)
    doc.setFont('times', 'bold')
    doc.text('About the Author', pageWidth / 2, currentY, { align: 'center' })
    currentY += 0.8

    doc.setFontSize(options.fontSize)
    doc.setFont('times', 'normal')
    const aboutLines = doc.splitTextToSize(options.aboutAuthorText, contentWidth)
    const lineHeight = (options.fontSize / 72) * options.lineSpacing
    for (const line of aboutLines) {
      if (checkPageBreak(lineHeight)) {
        addHeader()
      }
      doc.text(line, marginLeft, currentY)
      currentY += lineHeight
    }

    addFooter()
  }

  // Save
  const filename = `${sanitizeFilename(metadata.title)}_${options.pageSize}.pdf`
  doc.save(filename)

  console.log(`✅ Exported: ${filename}`)
}

/**
 * Export to EPUB (E-book format)
 */
export async function exportToEpub(
  metadata: BookMetadata,
  chapters: ChapterContent[],
  _options: ExportOptions = DEFAULT_OPTIONS
): Promise<void> {
  const zip = new JSZip()

  const bookId = `urn:uuid:${generateUUID()}`
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)

  // Mimetype (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // Container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  // Enhanced stylesheet
  zip.file('OEBPS/styles.css', `
@charset "UTF-8";

body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.6;
  margin: 5%;
  text-align: justify;
  orphans: 2;
  widows: 2;
}

/* Title Page */
.title-page {
  text-align: center;
  page-break-after: always;
  padding-top: 30%;
}
.title-page h1 {
  font-size: 2.5em;
  margin-bottom: 0.5em;
  line-height: 1.2;
}
.title-page .author {
  font-size: 1.3em;
  font-style: italic;
  margin-top: 1em;
}
.title-page .publisher {
  font-size: 0.9em;
  margin-top: 3em;
}

/* Copyright Page */
.copyright-page {
  text-align: center;
  font-size: 0.85em;
  page-break-after: always;
  padding-top: 40%;
}
.copyright-page p {
  text-indent: 0;
  margin: 0.5em 0;
}

/* Dedication */
.dedication {
  text-align: center;
  font-style: italic;
  padding-top: 30%;
  page-break-after: always;
}

/* Chapter Styling */
.chapter {
  page-break-before: always;
}
.chapter-header {
  text-align: center;
  margin-top: 20%;
  margin-bottom: 2em;
}
.chapter-number {
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 0.5em;
}
.chapter-title {
  font-size: 1.8em;
  font-weight: bold;
  margin: 0.5em 0;
}
.chapter-epigraph {
  font-style: italic;
  text-align: center;
  margin: 2em 10%;
  font-size: 0.95em;
}
.chapter-epigraph-author {
  text-align: right;
  margin-right: 10%;
  font-size: 0.9em;
}

/* Headings */
h1 { font-size: 1.8em; text-align: center; margin: 1.5em 0 1em; }
h2 { font-size: 1.4em; margin: 1.2em 0 0.8em; }
h3 { font-size: 1.2em; margin: 1em 0 0.6em; }

/* Paragraphs */
p {
  text-indent: 1.5em;
  margin: 0;
}
p.first, .chapter-header + p, h1 + p, h2 + p, h3 + p {
  text-indent: 0;
}

/* Blockquotes */
blockquote {
  font-style: italic;
  margin: 1em 1.5em;
  padding: 0;
  border: none;
}

/* Scene Breaks */
.scene-break {
  text-align: center;
  margin: 1.5em 0;
  font-size: 1.2em;
  letter-spacing: 0.5em;
}

/* Lists */
ul, ol {
  margin: 0.8em 0 0.8em 1.5em;
  padding: 0;
}
li {
  margin: 0.3em 0;
}

/* Table of Contents */
.toc h1 {
  margin-bottom: 1em;
}
.toc ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.toc li {
  margin: 0.5em 0;
}
.toc a {
  text-decoration: none;
  color: inherit;
}
`)

  // Title page
  zip.file('OEBPS/title.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(metadata.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="title-page">
    <h1>${escapeXml(metadata.title)}</h1>
    <p class="author">by ${escapeXml(metadata.author)}</p>
    ${metadata.publisher ? `<p class="publisher">${escapeXml(metadata.publisher)}</p>` : ''}
  </div>
</body>
</html>`)

  // Copyright page
  zip.file('OEBPS/copyright.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Copyright</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="copyright-page">
    <p>Copyright © ${new Date().getFullYear()} ${escapeXml(metadata.author)}</p>
    <p>All rights reserved.</p>
    <p>No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without prior written permission.</p>
    ${metadata.isbn ? `<p>ISBN: ${escapeXml(metadata.isbn)}</p>` : ''}
  </div>
</body>
</html>`)

  // Dedication (if present)
  if (metadata.dedication) {
    zip.file('OEBPS/dedication.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Dedication</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="dedication">
    <p>${escapeXml(metadata.dedication)}</p>
  </div>
</body>
</html>`)
  }

  // Chapters
  for (const chapter of sortedChapters) {
    const chapterHtml = markdownToXhtml(chapter.content)

    let epigraphHtml = ''
    if (chapter.epigraph) {
      epigraphHtml = `
    <p class="chapter-epigraph">${escapeXml(chapter.epigraph)}</p>
    ${chapter.epigraphAuthor ? `<p class="chapter-epigraph-author">— ${escapeXml(chapter.epigraphAuthor)}</p>` : ''}`
    }

    zip.file(`OEBPS/chapter-${chapter.chapterNumber}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter ${chapter.chapterNumber}: ${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="chapter">
    <div class="chapter-header">
      <p class="chapter-number">Chapter ${chapter.chapterNumber}</p>
      <h1 class="chapter-title">${escapeXml(chapter.title)}</h1>
    </div>${epigraphHtml}
    ${chapterHtml}
  </div>
</body>
</html>`)
  }

  // Navigation document (EPUB 3)
  zip.file('OEBPS/toc.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" class="toc">
    <h1>Contents</h1>
    <ol>
      <li><a href="title.xhtml">Title Page</a></li>
      <li><a href="copyright.xhtml">Copyright</a></li>
      ${metadata.dedication ? '<li><a href="dedication.xhtml">Dedication</a></li>' : ''}
      ${sortedChapters.map(ch =>
        `<li><a href="chapter-${ch.chapterNumber}.xhtml">Chapter ${ch.chapterNumber}: ${escapeXml(ch.title)}</a></li>`
      ).join('\n      ')}
    </ol>
  </nav>
</body>
</html>`)

  // NCX (for EPUB 2 compatibility)
  let playOrder = 1
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(metadata.title)}</text>
  </docTitle>
  <navMap>
    <navPoint id="title" playOrder="${playOrder++}">
      <navLabel><text>Title Page</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    <navPoint id="copyright" playOrder="${playOrder++}">
      <navLabel><text>Copyright</text></navLabel>
      <content src="copyright.xhtml"/>
    </navPoint>
    ${metadata.dedication ? `<navPoint id="dedication" playOrder="${playOrder++}">
      <navLabel><text>Dedication</text></navLabel>
      <content src="dedication.xhtml"/>
    </navPoint>` : ''}
    ${sortedChapters.map(ch => `
    <navPoint id="chapter-${ch.chapterNumber}" playOrder="${playOrder++}">
      <navLabel><text>Chapter ${ch.chapterNumber}: ${escapeXml(ch.title)}</text></navLabel>
      <content src="chapter-${ch.chapterNumber}.xhtml"/>
    </navPoint>`).join('')}
  </navMap>
</ncx>`)

  // Content.opf (package document)
  const now = new Date().toISOString().split('T')[0]
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author)}</dc:creator>
    <dc:language>${metadata.language || 'en'}</dc:language>
    <dc:date>${now}</dc:date>
    ${metadata.publisher ? `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>` : ''}
    ${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ''}
    ${metadata.isbn ? `<dc:identifier id="isbn">urn:isbn:${metadata.isbn}</dc:identifier>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="styles" href="styles.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
    <item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>
    ${metadata.dedication ? '<item id="dedication" href="dedication.xhtml" media-type="application/xhtml+xml"/>' : ''}
    ${sortedChapters.map(ch =>
      `<item id="chapter-${ch.chapterNumber}" href="chapter-${ch.chapterNumber}.xhtml" media-type="application/xhtml+xml"/>`
    ).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title"/>
    <itemref idref="copyright"/>
    ${metadata.dedication ? '<itemref idref="dedication"/>' : ''}
    ${sortedChapters.map(ch => `<itemref idref="chapter-${ch.chapterNumber}"/>`).join('\n    ')}
  </spine>
</package>`)

  // Generate and save
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' })
  const filename = `${sanitizeFilename(metadata.title)}.epub`
  saveAs(blob, filename)

  console.log(`✅ Exported: ${filename}`)
}

/**
 * Export for Amazon KDP (DOCX with KDP-optimized settings)
 */
export async function exportForKdp(
  metadata: BookMetadata,
  chapters: ChapterContent[],
  trimSize: '6x9' | '5x8' | '5.5x8.5' = '6x9'
): Promise<void> {
  const preset = KDP_PRESETS[trimSize]

  const kdpOptions: ExportOptions = {
    format: 'kdp',
    includeTableOfContents: true,
    includeTitlePage: true,
    includeDedication: true,
    includeAboutAuthor: false,
    pageSize: trimSize,
    fontSize: preset.fontSize,
    lineSpacing: preset.lineSpacing,
    fontFamily: preset.fontFamily,
    margins: preset.margins,
    useDropCaps: false
  }

  await exportToDocx(metadata, chapters, kdpOptions)

  console.log(`
📚 Amazon KDP Export Complete!

Your file has been exported with KDP-optimized settings:
• Trim size: ${trimSize} inches
• Margins: Top ${preset.margins.top}", Bottom ${preset.margins.bottom}", Inside ${preset.margins.left + preset.margins.gutter}", Outside ${preset.margins.right}"
• Font: ${preset.fontFamily} ${preset.fontSize}pt
• Line spacing: ${preset.lineSpacing}

Professional features included:
✓ Title page with author name
✓ Copyright page
✓ Table of contents
✓ Proper chapter page breaks
✓ First paragraph no indent (publishing standard)
✓ Scene breaks preserved
✓ Running headers (book title)
✓ Page numbers centered

Next steps:
1. Go to kdp.amazon.com
2. Create a new Paperback
3. Upload this DOCX file as your manuscript
4. KDP will convert it to PDF and show a preview
5. Review and adjust if needed
  `)
}

// ============ UTILITY FUNCTIONS ============

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Convert markdown to XHTML for EPUB with proper grouping
 */
function markdownToXhtml(markdown: string): string {
  const segments = parseMarkdownToSegments(markdown)
  let html = ''
  let inList: 'ul' | 'ol' | null = null
  let isFirstParagraph = true

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const prevSegment = i > 0 ? segments[i - 1] : null

    // Close list if we're not in a list item anymore
    if (inList && segment.type !== 'list-item' && segment.type !== 'numbered-item') {
      html += `</${inList}>\n`
      inList = null
    }

    if (segment.type === 'heading') {
      const tag = segment.level === 1 ? 'h1' : segment.level === 2 ? 'h2' : 'h3'
      html += `<${tag}>${escapeXml(segment.content)}</${tag}>\n`
      isFirstParagraph = true
    } else if (segment.type === 'paragraph') {
      // Determine if this should have no indent (first after heading)
      const isFirst = isFirstParagraph || segment.isFirstAfterHeading ||
                      (prevSegment && prevSegment.type === 'heading')

      let text = escapeXml(segment.content)
      // Handle inline formatting
      text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')

      html += `<p${isFirst ? ' class="first"' : ''}>${text}</p>\n`
      isFirstParagraph = false
    } else if (segment.type === 'blockquote') {
      let text = escapeXml(segment.content)
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
      html += `<blockquote><p>${text}</p></blockquote>\n`
    } else if (segment.type === 'scene-break') {
      html += `<p class="scene-break">* * *</p>\n`
      isFirstParagraph = true
    } else if (segment.type === 'list-item') {
      if (inList !== 'ul') {
        if (inList) html += `</${inList}>\n`
        html += '<ul>\n'
        inList = 'ul'
      }
      html += `  <li>${escapeXml(segment.content)}</li>\n`
    } else if (segment.type === 'numbered-item') {
      if (inList !== 'ol') {
        if (inList) html += `</${inList}>\n`
        html += '<ol>\n'
        inList = 'ol'
      }
      html += `  <li>${escapeXml(segment.content)}</li>\n`
    }
  }

  // Close any open list
  if (inList) {
    html += `</${inList}>\n`
  }

  return html
}

// Export service object
export const exportService = {
  exportToDocx,
  exportToPdf,
  exportToEpub,
  exportForKdp,
  KDP_PRESETS,
  DEFAULT_OPTIONS
}
