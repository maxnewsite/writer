import { useState, useEffect } from 'react'
import { db } from '../../services/database'

interface ResearchData {
  id: number
  chapter_id: number
  chapter_title: string
  book_niche: string
  book_title: string
  summary: string
  key_statistics: string
  recent_trends: string
  notable_quotes: string
  suggested_citations: string
  researched_at: string
  expires_at: string
}

interface Props {
  chapterId: number
  chapterTitle: string
  onClose: () => void
}

export default function ResearchPanel({ chapterId, chapterTitle, onClose }: Props): JSX.Element {
  const [research, setResearch] = useState<ResearchData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadResearch()
  }, [chapterId])

  const loadResearch = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await db.getChapterResearch(chapterId)
      if (data) {
        setResearch(data)
      } else {
        setError('No research data available for this chapter')
      }
    } catch (err) {
      console.error('Failed to load research:', err)
      setError('Failed to load research data')
    } finally {
      setIsLoading(false)
    }
  }

  const parseJsonArray = (jsonString: string): string[] => {
    try {
      return JSON.parse(jsonString)
    } catch {
      return []
    }
  }

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString()
  }

  const isExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date()
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading research data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !research) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">🔬 Research Data</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 font-semibold mb-2">⚠️ {error}</p>
            <p className="text-sm text-yellow-700">
              Research data is generated automatically when writing chapters.
              If this chapter was written, the research may have expired (24h cache).
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const statistics = parseJsonArray(research.key_statistics)
  const trends = parseJsonArray(research.recent_trends)
  const quotes = parseJsonArray(research.notable_quotes)
  const citations = parseJsonArray(research.suggested_citations)
  const expired = isExpired(research.expires_at)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🔬 Research Data</h2>
            <p className="text-sm text-gray-600 mt-1">{chapterTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-light"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Status Banner */}
          {expired && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 font-semibold">
                ⏰ This research data has expired
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Research is cached for 24 hours. Re-run chapter writing to refresh.
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">📋 Metadata</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Book:</span>
                <span className="ml-2 font-medium text-gray-900">{research.book_title}</span>
              </div>
              <div>
                <span className="text-gray-600">Niche:</span>
                <span className="ml-2 font-medium text-gray-900">{research.book_niche}</span>
              </div>
              <div>
                <span className="text-gray-600">Researched:</span>
                <span className="ml-2 font-medium text-gray-900">{formatDate(research.researched_at)}</span>
              </div>
              <div>
                <span className="text-gray-600">Expires:</span>
                <span className={`ml-2 font-medium ${expired ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDate(research.expires_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>Research Summary</span>
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-gray-800 leading-relaxed">{research.summary}</p>
            </div>
          </div>

          {/* Statistics */}
          {statistics.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📈</span>
                <span>Key Statistics ({statistics.length})</span>
              </h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {statistics.map((stat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-600 font-bold mt-1">•</span>
                      <span className="text-gray-800 flex-1">{stat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Trends */}
          {trends.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>🔮</span>
                <span>Recent Trends ({trends.length})</span>
              </h3>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {trends.map((trend, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-purple-600 font-bold mt-1">•</span>
                      <span className="text-gray-800 flex-1">{trend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Notable Quotes */}
          {quotes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>💡</span>
                <span>Notable Insights ({quotes.length})</span>
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <ul className="space-y-3">
                  {quotes.map((quote, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold mt-1">"</span>
                      <span className="text-gray-800 flex-1 italic">{quote}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📚</span>
                <span>Suggested Citations ({citations.length})</span>
              </h3>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <ul className="space-y-2">
                  {citations.map((citation, i) => (
                    <li key={i} className="text-sm text-gray-700 font-mono break-all">
                      [{i + 1}] {citation}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Empty State */}
          {statistics.length === 0 && trends.length === 0 && quotes.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">
                Research was conducted but no specific data points were found.
                This may happen for very niche topics with limited public information.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Total findings:</span>{' '}
            {statistics.length + trends.length + quotes.length}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
