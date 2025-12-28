import { useState } from 'react'
import { useDiscussionStore } from '../../store/discussionStore'
import { aiService } from '../../services/aiService'
import Spinner from '../common/Spinner'

interface Props {
  chapterId: number
  chapterTitle: string
  chapterContent: string
  onChapterImproved: (improvedContent: string) => void
}

export default function AIPromptPanel({ chapterId, chapterTitle, chapterContent, onChapterImproved }: Props): JSX.Element {
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set())
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const [isImprovingChapter, setIsImprovingChapter] = useState(false)
  const [feedbackReady, setFeedbackReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fetchQuestions, getTopQuestions } = useDiscussionStore()

  const topQuestions = getTopQuestions(10)

  const handleGenerateDebateQuestions = async () => {
    if (!chapterContent.trim()) {
      setError('Chapter content is empty. Write some content first.')
      return
    }

    setIsGeneratingQuestions(true)
    setError(null)
    setFeedbackReady(false)
    setSelectedQuestionIds(new Set())

    try {
      console.log('🤖 Generating AI reader feedback...')

      // Generate AI reader feedback questions
      const feedbackQuestions = await aiService.generateReaderFeedback(chapterTitle, chapterContent)

      // Save feedback questions to database
      const { createQuestion } = useDiscussionStore.getState()

      for (const feedback of feedbackQuestions) {
        try {
          await createQuestion(chapterId, feedback.question, feedback.persona)
        } catch (err) {
          console.warn('Failed to save question:', err)
        }
      }

      // Fetch updated questions
      await fetchQuestions(chapterId)
      setFeedbackReady(true)

      console.log('✅ AI reader feedback generated!')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate feedback'
      setError(errorMsg)
      console.error('Generate feedback error:', err)
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  const handleToggleQuestion = (questionId: number) => {
    const newSelected = new Set(selectedQuestionIds)
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId)
    } else {
      newSelected.add(questionId)
    }
    setSelectedQuestionIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedQuestionIds.size === topQuestions.length) {
      setSelectedQuestionIds(new Set())
    } else {
      setSelectedQuestionIds(new Set(topQuestions.map(q => q.id)))
    }
  }

  const handleRewriteWithSelectedFeedback = async () => {
    if (selectedQuestionIds.size === 0) {
      setError('Please select at least one conversation to use for rewriting.')
      return
    }

    setIsImprovingChapter(true)
    setError(null)

    try {
      // Get selected questions
      const selectedQuestions = topQuestions.filter(q => selectedQuestionIds.has(q.id))
      const feedbackPoints = selectedQuestions.map(q => q.text)

      console.log(`✏️ Rewriting chapter based on ${selectedQuestionIds.size} selected feedback points...`)

      // Build improvement prompt
      const prompt = `You are improving a book chapter based on reader feedback.

Original Chapter: "${chapterTitle}"

Current Content:
${chapterContent}

Reader Feedback to Address:
${feedbackPoints.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Requirements:
- Keep the same overall structure and length
- Address each feedback point naturally in the content
- Maintain the original writing style
- Add examples, clarifications, or explanations where readers asked for them
- Make the improvements flow naturally with the existing content

Write the improved chapter content:`

      const improvedContent = await aiService.generateChapterContent(prompt)

      if (improvedContent && improvedContent.trim()) {
        // Apply improved content
        onChapterImproved(improvedContent)
        console.log('✅ Chapter improved based on feedback!')
        setError(null)
      } else {
        throw new Error('Generated empty content')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to improve chapter'
      setError(errorMsg)
      console.error('Improve chapter error:', err)
    } finally {
      setIsImprovingChapter(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-gray-900 mb-2">
          💬 AI Reader Feedback Loop
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Generate 3 debate questions → AI readers discuss → Improve chapter based on feedback
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm mb-3">
            {error}
          </div>
        )}

        {/* Step 1: Generate Debate Questions */}
        {!feedbackReady && (
          <button
            onClick={handleGenerateDebateQuestions}
            disabled={isGeneratingQuestions || !chapterContent.trim()}
            className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 transition font-semibold flex items-center justify-center gap-2"
          >
            {isGeneratingQuestions ? (
              <>
                <Spinner /> AI Readers Debating...
              </>
            ) : (
              <>🎭 Generate AI Reader Feedback</>
            )}
          </button>
        )}

        {/* Step 2: Show Conversations & Select */}
        {feedbackReady && topQuestions.length > 0 && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">✅ AI Reader Discussions</h4>
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  {selectedQuestionIds.size === topQuestions.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <p className="text-xs text-gray-600 mb-3">
                Select the conversations you want to use for rewriting the chapter:
              </p>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {topQuestions.map((question) => (
                  <div
                    key={question.id}
                    className={`p-3 rounded border-2 cursor-pointer transition ${
                      selectedQuestionIds.has(question.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                    onClick={() => handleToggleQuestion(question.id)}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.has(question.id)}
                        onChange={() => handleToggleQuestion(question.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {question.text}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>👤 {question.author_name || 'Reader'}</span>
                          <span>👍 {question.vote_count} votes</span>
                          {(question.answers?.length || 0) > 0 && (
                            <span>💬 {question.answers?.length || 0} discussion{(question.answers?.length || 0) !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRewriteWithSelectedFeedback}
                disabled={isImprovingChapter || selectedQuestionIds.size === 0}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 transition font-semibold flex items-center justify-center gap-2"
              >
                {isImprovingChapter ? (
                  <>
                    <Spinner /> Rewriting...
                  </>
                ) : (
                  <>✏️ Rewrite with Selected ({selectedQuestionIds.size})</>
                )}
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center">
              Or close this panel and click "📤 Publish Chapter" to proceed without changes
            </div>
          </div>
        )}
      </div>

      {/* Info box when no feedback yet */}
      {!feedbackReady && topQuestions.length === 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
          <p className="font-semibold mb-2">How it works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>AI readers will read your chapter</li>
            <li>They'll ask questions and discuss</li>
            <li>You select the most valuable conversations</li>
            <li>AI rewrites chapter addressing those points</li>
            <li>Or skip and publish as-is</li>
          </ol>
        </div>
      )}
    </div>
  )
}
