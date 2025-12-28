import { useState } from 'react'
import { useDiscussionStore, type QuestionWithAnswers } from '../../store/discussionStore'
import AnswerForm from './AnswerForm'
import Spinner from '../common/Spinner'

interface Props {
  chapterId: number
  questions: QuestionWithAnswers[]
  onQuestionCreated?: () => void
  onAIGenerate?: () => Promise<void>
}

export default function QuestionList({ chapterId, questions, onQuestionCreated, onAIGenerate }: Props): JSX.Element {
  const [showForm, setShowForm] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes')
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { createQuestion, vote, isSaving } = useDiscussionStore()

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!questionText.trim() || !authorName.trim()) return

    try {
      await createQuestion(chapterId, questionText, authorName)
      setQuestionText('')
      setAuthorName('')
      setShowForm(false)
      onQuestionCreated?.()
    } catch (error) {
      console.error('Failed to submit question:', error)
    }
  }

  const handleVote = async (questionId: number) => {
    try {
      await vote(questionId)
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  const sortedQuestions = [...questions].sort((a, b) => {
    if (sortBy === 'votes') {
      return b.vote_count - a.vote_count
    } else {
      return b.created_at - a.created_at
    }
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white p-4">
        <h3 className="font-bold text-gray-900 mb-3">💬 Reader Questions ({questions.length})</h3>

        {/* Sort Toggle */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSortBy('votes')}
            className={`px-3 py-1 text-xs rounded transition ${
              sortBy === 'votes'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Top Voted
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-3 py-1 text-xs rounded transition ${
              sortBy === 'recent'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Recent
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition font-semibold"
          >
            {showForm ? '✕ Close' : '+ Manual Question'}
          </button>
          <button
            onClick={async () => {
              if (!onAIGenerate) return
              setIsGenerating(true)
              try {
                await onAIGenerate()
              } catch (error) {
                console.error('AI generation failed:', error)
              } finally {
                setIsGenerating(false)
              }
            }}
            disabled={isGenerating || !onAIGenerate}
            className="flex-1 px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:bg-gray-300 transition font-semibold flex items-center justify-center gap-1"
          >
            {isGenerating ? (
              <>
                <Spinner /> Generating...
              </>
            ) : (
              '🤖 AI Generate'
            )}
          </button>
        </div>
      </div>

      {/* Question Form */}
      {showForm && (
        <div className="border-b border-gray-200 bg-blue-50 p-4">
          <form onSubmit={handleSubmitQuestion} className="space-y-3">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name (or pseudonym)"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="What's your question about this chapter?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <button
              type="submit"
              disabled={isSaving || !questionText.trim() || !authorName.trim()}
              className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300 transition font-semibold flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Spinner /> Submitting...
                </>
              ) : (
                '✓ Submit Question'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto">
        {sortedQuestions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>No questions yet.</p>
            <p className="text-xs mt-2">Be the first to ask something!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedQuestions.map((question) => (
              <div key={question.id} className="p-4 hover:bg-gray-50 transition">
                {/* Question Header */}
                <div className="flex items-start gap-3 mb-2">
                  {/* Vote Button */}
                  <button
                    onClick={() => handleVote(question.id)}
                    disabled={isSaving}
                    className="flex flex-col items-center gap-1 pt-1"
                  >
                    <span className="text-lg">▲</span>
                    <span className="text-xs font-bold text-gray-700">
                      {question.vote_count}
                    </span>
                  </button>

                  {/* Question Text */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() =>
                        setExpandedQuestionId(
                          expandedQuestionId === question.id ? null : question.id
                        )
                      }
                      className="text-left w-full"
                    >
                      <p className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition">
                        {question.text}
                      </p>
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      by <span className="font-semibold">{question.author_name}</span> •{' '}
                      {new Date(question.created_at * 1000).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                      question.status === 'answered'
                        ? 'bg-green-100 text-green-700'
                        : question.status === 'incorporated'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {question.status}
                  </span>
                </div>

                {/* Expanded Answers */}
                {expandedQuestionId === question.id && (
                  <div className="mt-4 ml-9 border-l-2 border-gray-200 pl-3">
                    <div className="space-y-3">
                      {question.answers && question.answers.length > 0 ? (
                        question.answers.map((answer) => (
                          <div key={answer.id} className="text-sm">
                            <p className="font-semibold text-gray-700 mb-1">
                              {answer.is_from_author ? '✍️ Author' : '👤 Reader'}
                            </p>
                            <p className="text-gray-600 text-xs leading-relaxed">
                              {answer.text}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No answers yet</p>
                      )}
                    </div>

                    {/* Answer Form */}
                    <AnswerForm
                      questionId={question.id}
                      onAnswerAdded={() => {
                        onQuestionCreated?.()
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
