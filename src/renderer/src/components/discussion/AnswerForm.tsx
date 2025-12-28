import { useState } from 'react'
import { useDiscussionStore } from '../../store/discussionStore'
import Spinner from '../common/Spinner'

interface Props {
  questionId: number
  onAnswerAdded?: () => void
}

export default function AnswerForm({ questionId, onAnswerAdded }: Props): JSX.Element {
  const [answerText, setAnswerText] = useState('')
  const [isAuthor, setIsAuthor] = useState(true)
  const { addAnswer, isSaving } = useDiscussionStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answerText.trim()) return

    try {
      await addAnswer(questionId, answerText, isAuthor)
      setAnswerText('')
      onAnswerAdded?.()
    } catch (error) {
      console.error('Failed to submit answer:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3">
      <textarea
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        placeholder="Write your answer..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isAuthor}
            onChange={(e) => setIsAuthor(e.target.checked)}
            className="rounded"
          />
          <span>Post as Author</span>
        </label>

        <button
          type="submit"
          disabled={isSaving || !answerText.trim()}
          className="ml-auto px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:bg-gray-300 transition flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Spinner /> Submitting...
            </>
          ) : (
            '✓ Answer'
          )}
        </button>
      </div>
    </form>
  )
}
