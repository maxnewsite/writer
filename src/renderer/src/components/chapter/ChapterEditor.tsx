import { useState, useEffect, useRef } from 'react'
import { useChapterStore, type ChapterData } from '../../store/chapterStore'
import { useBookStore } from '../../store/bookStore'
import { db } from '../../services/database'
import { exportChapterAsMarkdown, exportChapterAsDocx } from '../../utils/export'
import Spinner from '../common/Spinner'
import AIPromptPanel from './AIPromptPanel'
import ChapterWorkflowPanel from './ChapterWorkflowPanel'

interface Props {
  chapter: ChapterData
  onQuestionCreated?: () => void
}

export default function ChapterEditor({ chapter }: Props): JSX.Element {
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showPromptPanel, setShowPromptPanel] = useState(false)
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPublishing, setIsPublishing] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const { updateChapterVersion } = useChapterStore()
  const { currentBook } = useBookStore()

  // Load latest chapter content when chapter changes
  useEffect(() => {
    const loadChapterContent = async () => {
      try {
        const latestVersion = await db.getLatestVersion(chapter.id)
        if (latestVersion && latestVersion.content) {
          setContent(latestVersion.content)
        } else {
          setContent('')
        }
      } catch (error) {
        console.error('Failed to load chapter content:', error)
        setContent('')
      }
    }

    loadChapterContent()
  }, [chapter.id])

  // Auto-save on content change
  useEffect(() => {
    // Don't auto-save if content is empty or hasn't changed from initial load
    if (!content.trim()) {
      setAutoSaveStatus('idle')
      return
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set typing indicator
    setAutoSaveStatus('idle')

    // Debounce save
    saveTimeoutRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        await updateChapterVersion(chapter.id, content, 'Auto-saved')
        setAutoSaveStatus('saved')
        // Reset to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Auto-save failed:', error)
        setAutoSaveStatus('idle')
      }
    }, 2000) // 2 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, chapter.id])

  const handlePublish = async () => {
    // In a full implementation, we would publish the current version
    // For now, just show the intention
    setIsPublishing(true)
    try {
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleTogglePromptPanel = () => {
    setShowPromptPanel(!showPromptPanel)
  }

  const handleDraftGenerated = (draft: string) => {
    setContent(draft)
    setShowWorkflowPanel(false)
  }

  const handleRedraftGenerated = (redraft: string) => {
    setContent(redraft)
  }

  const handleChapterImproved = (improvedContent: string) => {
    setContent(improvedContent)
    setShowPromptPanel(false)
  }

  const handleExportMarkdown = () => {
    if (!content.trim()) {
      alert('Chapter content is empty. Write some content first.')
      return
    }
    exportChapterAsMarkdown(`Chapter ${chapter.chapter_number} - ${chapter.title}`, content)
  }

  const handleExportDocx = () => {
    if (!content.trim()) {
      alert('Chapter content is empty. Write some content first.')
      return
    }
    exportChapterAsDocx(`Chapter ${chapter.chapter_number} - ${chapter.title}`, content)
  }

  const renderMarkdown = (md: string): string => {
    // Simple markdown rendering (in production, use markdown-it properly)
    return md
      .split('\n')
      .map(line => {
        if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`
        if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`
        if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`
        if (line.startsWith('- ')) return `<li>${line.substring(2)}</li>`
        if (line.startsWith('* ')) return `<li>${line.substring(2)}</li>`
        if (line.trim()) return `<p>${line}</p>`
        return ''
      })
      .join('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Chapter {chapter.chapter_number}: {chapter.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Status: <span className="font-semibold">{chapter.status}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Auto-save indicator */}
            <div className="flex items-center gap-2">
              {autoSaveStatus === 'saving' && (
                <>
                  <Spinner />
                  <span className="text-sm text-blue-600">Saving...</span>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-sm text-green-600">✓ Saved</span>
              )}
            </div>

            {/* Toggle Preview */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm font-semibold"
            >
              {showPreview ? '✏️ Edit' : '👁️ Preview'}
            </button>

            {/* AI Workflow */}
            <button
              onClick={() => setShowWorkflowPanel(!showWorkflowPanel)}
              className={`px-4 py-2 rounded transition text-sm font-semibold ${
                showWorkflowPanel
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title="Automated chapter drafting workflow"
            >
              🤖 AI Workflow
            </button>

            {/* AI Feedback */}
            <button
              onClick={handleTogglePromptPanel}
              className={`px-4 py-2 rounded transition text-sm font-semibold ${
                showPromptPanel
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
              title="Get AI reader feedback and improve chapter"
            >
              💡 AI Feedback
            </button>

            {/* Publish Button */}
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 transition text-sm font-semibold flex items-center gap-2"
            >
              {isPublishing ? (
                <>
                  <Spinner /> Publishing...
                </>
              ) : (
                <>📤 Publish Chapter</>
              )}
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition text-sm font-semibold">
                💾 Export ▾
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={handleExportMarkdown}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-medium text-gray-700 rounded-t-lg"
                >
                  📄 Download as Markdown
                </button>
                <button
                  onClick={handleExportDocx}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm font-medium text-gray-700 rounded-b-lg"
                >
                  📝 Download as DOCX
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor / Preview & Panels */}
      <div className="flex-1 overflow-hidden flex gap-4">
        {/* Workflow Panel */}
        {showWorkflowPanel && currentBook && (
          <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">AI Workflow</h3>
              <button
                onClick={() => setShowWorkflowPanel(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ChapterWorkflowPanel
              chapterId={chapter.id}
              chapterNumber={chapter.chapter_number}
              chapterTitle={chapter.title}
              chapterContent={content}
              bookContext={{
                title: currentBook.title,
                description: currentBook.description || '',
                previousChapters: []
              }}
              onDraftGenerated={handleDraftGenerated}
              onRedraftGenerated={handleRedraftGenerated}
            />
          </div>
        )}

        {/* Main Editor */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showPreview ? (
            // Preview Mode
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </div>
          ) : (
            // Edit Mode
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your chapter here...

# Chapter Title
## Section 1
Your content goes here...

Markdown is supported!"
              className="flex-1 p-6 border-none focus:outline-none font-mono text-sm resize-none"
            />
          )}
        </div>

        {/* AI Feedback Panel */}
        {showPromptPanel && (
          <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">AI Feedback</h3>
              <button
                onClick={handleTogglePromptPanel}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <AIPromptPanel
              chapterId={chapter.id}
              chapterTitle={chapter.title}
              chapterContent={content}
              onChapterImproved={handleChapterImproved}
            />
          </div>
        )}
      </div>

      {/* Footer: Word Count & Stats */}
      <div className="border-t border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            <span className="font-semibold">{content.split(/\s+/).filter(w => w).length}</span>
            {' '}words · {' '}
            <span className="font-semibold">{content.length}</span>
            {' '}characters
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {new Date(chapter.updated_at * 1000).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}
