import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBookStore } from '../store/bookStore'
import { useAppStore } from '../store/appStore'
import { db } from '../services/database'
import { type ChapterContent } from '../services/exportService'
import Spinner from '../components/common/Spinner'
import ExportDialog from '../components/export/ExportDialog'

interface ExportState {
  isOpen: boolean
  bookId: number | null
  bookTitle: string
  bookDescription?: string
  chapters: ChapterContent[]
}

export default function Dashboard(): JSX.Element {
  const { books, fetchBooks } = useBookStore()
  const { activeProvider, providerConnections } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingExport, setLoadingExport] = useState<number | null>(null)
  const [exportState, setExportState] = useState<ExportState>({
    isOpen: false,
    bookId: null,
    bookTitle: '',
    chapters: []
  })

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        await fetchBooks()
      } catch (err) {
        console.error('Failed to fetch books:', err)
        setError('Failed to load books. Please try refreshing.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleOpenExport = async (book: { id: number; title: string; description?: string }) => {
    setLoadingExport(book.id)
    try {
      // Fetch all chapters for this book
      const dbChapters = await db.getChaptersByBook(book.id)

      if (dbChapters.length === 0) {
        alert('This book has no chapters to export.')
        return
      }

      // Get chapter content from versions
      const chaptersWithContent = await Promise.all(
        dbChapters.map(async (ch) => {
          const latestVersion = await db.getLatestVersion(ch.id)
          return {
            title: ch.title,
            chapterNumber: ch.order_index,
            content: latestVersion?.content || ''
          }
        })
      )

      // Filter out chapters with no content
      const validChapters = chaptersWithContent.filter(ch => ch.content.trim().length > 0)

      if (validChapters.length === 0) {
        alert('No chapters have content to export.')
        return
      }

      // Open export dialog with chapters data
      setExportState({
        isOpen: true,
        bookId: book.id,
        bookTitle: book.title,
        bookDescription: book.description,
        chapters: validChapters
      })
    } catch (error) {
      console.error('Failed to load chapters:', error)
      alert('Failed to load chapters. Please try again.')
    } finally {
      setLoadingExport(null)
    }
  }

  const handleCloseExport = () => {
    setExportState({
      isOpen: false,
      bookId: null,
      bookTitle: '',
      chapters: []
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          📚 Book Writer Studio
        </h1>
        <p className="text-lg text-gray-600">
          Create collaborative books powered by local AI
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-8">
        <div
          className={`p-4 rounded-lg ${
            providerConnections[activeProvider]
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={providerConnections[activeProvider] ? 'text-green-800' : 'text-yellow-800'}>
              {providerConnections[activeProvider]
                ? `✅ ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is connected and ready`
                : `⚠️ ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is not connected. Make sure it's running on ${activeProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}`}
            </p>
            <Link
              to="/settings"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* New Book Button */}
      <div className="mb-12">
        <Link
          to="/books/new"
          className="inline-block px-8 py-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
        >
          ✨ Create New Book
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-semibold">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
          >
            Refresh page
          </button>
        </div>
      )}

      {/* Books List */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Books</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Spinner />
              <p className="mt-4 text-gray-600">Loading your books...</p>
            </div>
          </div>
        ) : books.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div
                key={book.id}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition bg-white"
              >
                <Link to={`/books/${book.id}`} className="block hover:text-blue-600">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">{book.niche}</p>
                </Link>

                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-gray-500">
                    Status: {book.status}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      book.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : book.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {book.status === 'setup' && '🚀 Setup'}
                    {book.status === 'in_progress' && '✍️ Writing'}
                    {book.status === 'completed' && '✅ Done'}
                  </span>
                </div>

                {/* Export Button */}
                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handleOpenExport(book)
                    }}
                    disabled={loadingExport === book.id}
                    className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 transition font-semibold flex items-center justify-center gap-2"
                  >
                    {loadingExport === book.id ? (
                      <>
                        <Spinner /> Loading...
                      </>
                    ) : (
                      <>📚 Export (DOCX, PDF, EPUB, KDP)</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No books yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first collaborative book with AI assistance
            </p>
            <Link
              to="/books/new"
              className="inline-block px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
            >
              Create Book
            </Link>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportState.isOpen}
        onClose={handleCloseExport}
        bookTitle={exportState.bookTitle}
        bookDescription={exportState.bookDescription}
        chapters={exportState.chapters}
      />
    </div>
  )
}
