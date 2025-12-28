import { useState } from 'react'
import {
  exportService,
  type BookMetadata,
  type ChapterContent,
  type ExportOptions,
  KDP_PRESETS
} from '../../services/exportService'
import Spinner from '../common/Spinner'

interface Props {
  isOpen: boolean
  onClose: () => void
  bookTitle: string
  bookDescription?: string
  chapters: ChapterContent[]
}

export default function ExportDialog({ isOpen, onClose, bookTitle, bookDescription, chapters }: Props): JSX.Element | null {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'docx' | 'pdf' | 'epub' | 'kdp'>('docx')
  const [kdpTrimSize, setKdpTrimSize] = useState<'6x9' | '5x8' | '5.5x8.5'>('6x9')
  const [includeToC, setIncludeToC] = useState(true)
  const [includeTitlePage, setIncludeTitlePage] = useState(true)
  const [includeDedication, setIncludeDedication] = useState(false)
  const [dedication, setDedication] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [isbn, setIsbn] = useState('')
  const [publisher, setPublisher] = useState('')

  if (!isOpen) return null

  const handleExport = async () => {
    if (!authorName.trim()) {
      alert('Please enter an author name')
      return
    }

    if (chapters.length === 0) {
      alert('No chapters to export')
      return
    }

    setIsExporting(true)

    try {
      const metadata: BookMetadata = {
        title: bookTitle,
        author: authorName.trim(),
        description: bookDescription,
        isbn: isbn.trim() || undefined,
        publisher: publisher.trim() || undefined,
        dedication: includeDedication && dedication.trim() ? dedication.trim() : undefined,
        language: 'en'
      }

      const options: ExportOptions = {
        format: exportFormat,
        includeTableOfContents: includeToC,
        includeTitlePage: includeTitlePage,
        includeDedication: includeDedication,
        includeAboutAuthor: false,
        pageSize: exportFormat === 'kdp' ? kdpTrimSize : '6x9',
        fontSize: 11,
        lineSpacing: 1.5,
        fontFamily: 'Times New Roman',
        margins: KDP_PRESETS[kdpTrimSize].margins,
        useDropCaps: false
      }

      switch (exportFormat) {
        case 'docx':
          await exportService.exportToDocx(metadata, chapters, options)
          break
        case 'pdf':
          await exportService.exportToPdf(metadata, chapters, options)
          break
        case 'epub':
          await exportService.exportToEpub(metadata, chapters, options)
          break
        case 'kdp':
          await exportService.exportForKdp(metadata, chapters, kdpTrimSize)
          break
      }

      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please check the console for details.')
    } finally {
      setIsExporting(false)
    }
  }

  const formatDescriptions = {
    docx: 'Microsoft Word document. Can be edited and formatted further.',
    pdf: 'Portable Document Format. Ready for print or digital distribution.',
    epub: 'E-book format. Compatible with Kindle, Apple Books, Kobo, and more.',
    kdp: 'Amazon KDP-optimized Word document with proper margins and formatting for paperback publishing.'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Export Book</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Book Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">{bookTitle}</h3>
            <p className="text-sm text-gray-600">
              {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} ready for export
            </p>
          </div>

          {/* Export Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['docx', 'pdf', 'epub', 'kdp'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setExportFormat(format)}
                  className={`p-4 rounded-lg border-2 text-left transition ${
                    exportFormat === format
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">
                      {format === 'docx' && '📝'}
                      {format === 'pdf' && '📄'}
                      {format === 'epub' && '📱'}
                      {format === 'kdp' && '📚'}
                    </span>
                    <span className="font-semibold text-gray-900 uppercase">
                      {format === 'kdp' ? 'Amazon KDP' : format}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {formatDescriptions[format]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* KDP Trim Size (only for KDP format) */}
          {exportFormat === 'kdp' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Trim Size (Book Dimensions)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['6x9', '5.5x8.5', '5x8'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setKdpTrimSize(size)}
                    className={`py-2 px-4 rounded-lg border text-sm font-medium transition ${
                      kdpTrimSize === size
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {size}"
                    <span className="block text-xs font-normal text-gray-500">
                      {size === '6x9' && '(Most popular)'}
                      {size === '5.5x8.5' && '(Digest)'}
                      {size === '5x8' && '(Compact)'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                6x9" is the most common size for non-fiction and novels.
              </p>
            </div>
          )}

          {/* Metadata Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Author Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name as it appears on the book"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  ISBN (Optional)
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-0-000-00000-0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Publisher (Optional)
                </label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="Publisher name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Include
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTitlePage}
                onChange={(e) => setIncludeTitlePage(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Title Page</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeToC}
                onChange={(e) => setIncludeToC(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Table of Contents</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDedication}
                onChange={(e) => setIncludeDedication(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Dedication Page</span>
            </label>
          </div>

          {/* Dedication Text */}
          {includeDedication && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Dedication Text
              </label>
              <textarea
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
                placeholder="To my family, who believed in me..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* KDP Info Box */}
          {exportFormat === 'kdp' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <span>📚</span> Amazon KDP Publishing Tips
              </h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Upload this file at <a href="https://kdp.amazon.com" target="_blank" rel="noopener noreferrer" className="underline">kdp.amazon.com</a></li>
                <li>• KDP will convert the DOCX to their print-ready format</li>
                <li>• Use the KDP previewer to check formatting before publishing</li>
                <li>• Margins are pre-set to KDP's minimum requirements</li>
                <li>• Consider adding a cover using KDP's cover creator</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !authorName.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Spinner /> Exporting...
              </>
            ) : (
              <>
                {exportFormat === 'kdp' ? '📚 Export for KDP' : `Export ${exportFormat.toUpperCase()}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
