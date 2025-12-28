import { create } from 'zustand'
import { db } from '../services/database'

export interface BookData {
  id: number
  title: string
  niche: string
  description?: string
  outline: string // JSON string
  status?: 'setup' | 'in_progress' | 'completed'
  ai_model_used?: string
  created_at: string
  updated_at: string
}

// Helper to ensure book has default status
function normalizeBook(book: Omit<BookData, 'status'> & { status?: string }): BookData {
  return {
    ...book,
    status: (book.status as BookData['status']) || 'setup'
  }
}

export interface OutlineNode {
  id: string
  type: 'chapter' | 'section' | 'subsection'
  title: string
  description?: string
  children?: OutlineNode[]
}

interface BookState {
  books: BookData[]
  currentBook: BookData | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchBooks: () => Promise<void>
  selectBook: (id: number) => Promise<void>
  createBook: (data: {
    title: string
    niche: string
    description?: string
    outline: OutlineNode[]
  }) => Promise<BookData>
  updateBook: (id: number, data: Partial<BookData>) => Promise<void>
  deleteBook: (id: number) => Promise<void>
  clearError: () => void
  resetCurrentBook: () => void
}

export const useBookStore = create<BookState>((set) => ({
  books: [],
  currentBook: null,
  isLoading: false,
  error: null,

  fetchBooks: async () => {
    set({ isLoading: true, error: null })
    try {
      const books = await db.getAllBooks()
      set({ books: books.map(normalizeBook), isLoading: false })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch books'
      set({ error: errorMsg, isLoading: false })
    }
  },

  selectBook: async (id: number) => {
    try {
      const book = await db.getBookById(id)
      if (book) {
        set({ currentBook: normalizeBook(book), error: null })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to select book'
      set({ error: errorMsg })
    }
  },

  createBook: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const book = await db.createBook({
        title: data.title,
        niche: data.niche,
        description: data.description || '',
        outline: JSON.stringify(data.outline),
        status: 'setup',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      if (!book) throw new Error('Failed to create book')
      const normalizedBook = normalizeBook(book)
      set((state) => ({
        books: [...state.books, normalizedBook],
        currentBook: normalizedBook,
        isLoading: false
      }))
      return normalizedBook
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create book'
      set({ error: errorMsg, isLoading: false })
      throw error
    }
  },

  updateBook: async (id: number, data: Partial<BookData>) => {
    set({ isLoading: true, error: null })
    try {
      // Convert outline back to string if it's an array, and exclude non-DB fields
      const { status: _status, ai_model_used: _aiModel, ...dbFields } = data
      const updateData = {
        ...dbFields,
        outline: typeof data.outline === 'string' ? data.outline : JSON.stringify(data.outline)
      }
      const updated = await db.updateBook(id, updateData)
      const normalizedUpdated = normalizeBook({ ...updated, status: data.status })

      set((state) => {
        const books = state.books.map((b) => (b.id === id ? normalizedUpdated : b))
        const currentBook = state.currentBook?.id === id ? normalizedUpdated : state.currentBook
        return { books, currentBook, isLoading: false }
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update book'
      set({ error: errorMsg, isLoading: false })
    }
  },

  deleteBook: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      await db.deleteBook(id)
      set((state) => ({
        books: state.books.filter((b) => b.id !== id),
        currentBook: state.currentBook?.id === id ? null : state.currentBook,
        isLoading: false
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete book'
      set({ error: errorMsg, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),

  resetCurrentBook: () => set({ currentBook: null })
}))
