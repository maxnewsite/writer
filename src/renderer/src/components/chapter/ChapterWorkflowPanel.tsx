import { useState } from 'react'
import { aiService } from '../../services/aiService'
import Spinner from '../common/Spinner'

interface FeedbackAnalysis {
  topConcerns: string[]
  suggestedImprovements: string[]
  strengths: string[]
  shouldRedraft: boolean
  confidenceScore: number
}

interface Props {
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  chapterContent: string
  bookContext: {
    title: string
    description: string
    previousChapters?: string[]
  }
  onDraftGenerated: (draft: string) => void
  onRedraftGenerated: (redraft: string) => void
}

type WorkflowState =
  | 'idle'
  | 'generating-draft'
  | 'draft-ready'
  | 'generating-feedback'
  | 'feedback-ready'
  | 'analyzing'
  | 'analysis-ready'
  | 'redrafting'

export default function ChapterWorkflowPanel({
  chapterNumber,
  chapterTitle,
  chapterContent,
  bookContext,
  onDraftGenerated
}: Props): JSX.Element {
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle')
  const [feedbackAnalysis, setFeedbackAnalysis] = useState<FeedbackAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateDraft = async () => {
    setWorkflowState('generating-draft')
    setError(null)

    try {
      const prompt = `You are writing a book chapter draft.

Book: "${bookContext.title}"
Description: ${bookContext.description}

Chapter ${chapterNumber}: ${chapterTitle}

Requirements:
- Write a comprehensive draft of 800-1200 words
- Use clear, engaging language
- Include practical examples
- Structure with ## subheadings
- Make it valuable for readers

Write the complete chapter draft now:`

      const draft = await aiService.generateChapterContent(prompt)

      if (draft && draft.trim()) {
        onDraftGenerated(draft)
        setWorkflowState('draft-ready')
      } else {
        throw new Error('Generated empty content')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate draft')
      setWorkflowState('idle')
    }
  }

  const handleGenerateFeedback = async () => {
    if (!chapterContent.trim()) {
      setError('Chapter content is empty. Cannot generate feedback.')
      return
    }

    setError('🚧 AI Feedback Generation is being updated for web mode. This feature will be available soon.')
  }

  const handleAnalyzeFeedback = async () => {
    setError('🚧 Feedback Analysis is being updated for web mode. This feature will be available soon.')
  }

  const handleRedraft = async () => {
    setError('🚧 AI Redrafting is being updated for web mode. This feature will be available soon.')
  }

  const handleSkipRedraft = () => {
    setWorkflowState('draft-ready')
    setFeedbackAnalysis(null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-bold text-gray-900">📋 Chapter Workflow</h3>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800 text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* Workflow State Indicator */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold">Status:</span>
        {workflowState === 'idle' && <span className="text-gray-500">Ready to start</span>}
        {workflowState === 'generating-draft' && (
          <span className="text-blue-600 flex items-center gap-2">
            <Spinner /> Generating initial draft...
          </span>
        )}
        {workflowState === 'draft-ready' && <span className="text-green-600">✓ Draft ready</span>}
        {workflowState === 'generating-feedback' && (
          <span className="text-blue-600 flex items-center gap-2">
            <Spinner /> AI readers generating feedback...
          </span>
        )}
        {workflowState === 'feedback-ready' && <span className="text-green-600">✓ Feedback generated</span>}
        {workflowState === 'analyzing' && (
          <span className="text-blue-600 flex items-center gap-2">
            <Spinner /> Analyzing feedback...
          </span>
        )}
        {workflowState === 'analysis-ready' && <span className="text-purple-600">✓ Analysis complete</span>}
        {workflowState === 'redrafting' && (
          <span className="text-blue-600 flex items-center gap-2">
            <Spinner /> Redrafting chapter...
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Step 1: Generate Draft */}
        {workflowState === 'idle' && (
          <button
            onClick={handleGenerateDraft}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition font-semibold"
          >
            🤖 Generate Initial Draft
          </button>
        )}

        {/* Step 2: Get AI Feedback */}
        {workflowState === 'draft-ready' && (
          <button
            onClick={handleGenerateFeedback}
            className="w-full px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 transition font-semibold"
          >
            👥 Get AI Reader Feedback
          </button>
        )}

        {/* Step 3: Analyze Feedback */}
        {workflowState === 'feedback-ready' && (
          <button
            onClick={handleAnalyzeFeedback}
            className="w-full px-4 py-3 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition font-semibold"
          >
            📊 Analyze Feedback
          </button>
        )}

        {/* Step 4: Review Analysis & Decide */}
        {workflowState === 'analysis-ready' && feedbackAnalysis && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="font-bold text-gray-900">📊 Feedback Analysis</h4>

              {/* Confidence Score */}
              <div>
                <span className="text-sm font-semibold">Confidence Score: </span>
                <span className={`text-sm ${feedbackAnalysis.confidenceScore > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {(feedbackAnalysis.confidenceScore * 100).toFixed(0)}%
                </span>
              </div>

              {/* Top Concerns */}
              {feedbackAnalysis.topConcerns.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">⚠️ Reader Concerns:</h5>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {feedbackAnalysis.topConcerns.map((concern, i) => (
                      <li key={i}>{concern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Improvements */}
              {feedbackAnalysis.suggestedImprovements.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">💡 Suggested Improvements:</h5>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {feedbackAnalysis.suggestedImprovements.map((improvement, i) => (
                      <li key={i}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {feedbackAnalysis.strengths.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">✨ Strengths:</h5>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {feedbackAnalysis.strengths.map((strength, i) => (
                      <li key={i}>{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              <div className="pt-2 border-t border-gray-300">
                <p className="text-sm font-semibold">
                  {feedbackAnalysis.shouldRedraft ? (
                    <span className="text-orange-600">📝 Recommendation: Redraft suggested</span>
                  ) : (
                    <span className="text-green-600">✅ Recommendation: Chapter is ready</span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRedraft}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 transition font-semibold"
              >
                ✏️ Redraft with Feedback
              </button>
              <button
                onClick={handleSkipRedraft}
                className="flex-1 px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 transition font-semibold"
              >
                ✓ Keep Current Draft
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 pt-3 border-t border-gray-200">
        <p>
          <strong>Automated Workflow:</strong> Generate draft → Get AI reader feedback → Analyze feedback →
          Redraft if needed → Publish when satisfied
        </p>
      </div>
    </div>
  )
}
