import { create } from 'zustand'
import { db } from '../services/database'

export interface ChapterData {
  id: number
  book_id: number
  chapter_number: number
  title: string
  status: 'draft' | 'published' | 'archived'
  created_at: number
  updated_at: number
}

export interface ChapterVersionData {
  id: number
  chapter_id: number
  content: string
  version_number: number
  change_summary?: string
  is_published: boolean
  created_at: number
}

interface ChapterState {
  chapters: ChapterData[]
  currentChapter: ChapterData | null
  currentVersion: ChapterVersionData | null
  versions: ChapterVersionData[]
  isLoading: boolean
  isSaving: boolean
  error: string | null

  // Actions
  fetchChapters: (bookId: number) => Promise<void>
  selectChapter: (chapterId: number) => Promise<void>
  createChapter: (bookId: number, data: {
    chapter_number: number
    title: string
    content?: string
  }) => Promise<ChapterData>
  updateChapterVersion: (chapterId: number, content: string, summary?: string) => Promise<ChapterVersionData>
  publishVersion: (versionId: number) => Promise<void>
  fetchVersions: (chapterId: number) => Promise<void>
  clearError: () => void
}

export const useChapterStore = create<ChapterState>((set) => ({
  chapters: [],
  currentChapter: null,
  currentVersion: null,
  versions: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetchChapters: async (bookId: number) => {
    set({ isLoading: true, error: null })
    try {
      const dbChapters = await db.getChaptersByBook(bookId)
      // Map database schema to ChapterData
      const chapters: ChapterData[] = dbChapters.map(ch => ({
        id: ch.id,
        book_id: ch.book_id,
        chapter_number: ch.order_index,
        title: ch.title,
        status: 'draft' as const,
        created_at: new Date(ch.created_at).getTime(),
        updated_at: new Date(ch.updated_at).getTime()
      }))
      set({ chapters, isLoading: false })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch chapters'
      set({ error: errorMsg, isLoading: false })
    }
  },

  selectChapter: async (chapterId: number) => {
    try {
      // Find chapter in list
      const chapter = useChapterStore.getState().chapters.find(c => c.id === chapterId)
      if (chapter) {
        set({ currentChapter: chapter })
        // Fetch versions for this chapter
        await useChapterStore.getState().fetchVersions(chapterId)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to select chapter'
      set({ error: errorMsg })
    }
  },

  createChapter: async (bookId: number, data) => {
    set({ isLoading: true, error: null })
    try {
      const now = new Date().toISOString()
      const dbChapter = await db.createChapter({
        book_id: bookId,
        title: data.title,
        order_index: data.chapter_number,
        created_at: now,
        updated_at: now
      })

      // Map to ChapterData
      const chapter: ChapterData = {
        id: dbChapter!.id,
        book_id: dbChapter!.book_id,
        chapter_number: dbChapter!.order_index,
        title: dbChapter!.title,
        status: 'draft',
        created_at: new Date(dbChapter!.created_at).getTime(),
        updated_at: new Date(dbChapter!.updated_at).getTime()
      }

      // Create initial version if content is provided
      if (data.content) {
        await db.createChapterVersion({
          chapter_id: chapter.id,
          content: data.content,
          summary: null,
          is_published: 0,
          version_number: 1,
          created_at: now
        })
      }

      set((state) => ({
        chapters: [...state.chapters, chapter],
        currentChapter: chapter,
        isLoading: false
      }))
      return chapter
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create chapter'
      set({ error: errorMsg, isLoading: false })
      throw error
    }
  },

  updateChapterVersion: async (chapterId: number, content: string, summary?: string) => {
    set({ isSaving: true, error: null })
    try {
      // Get existing versions to determine version number
      const existingVersions = await db.getLatestVersion(chapterId)
      const versionNumber = existingVersions ? existingVersions.version_number + 1 : 1

      const dbVersion = await db.createChapterVersion({
        chapter_id: chapterId,
        content,
        summary: summary || null,
        is_published: 0,
        version_number: versionNumber,
        created_at: new Date().toISOString()
      })

      // Map to ChapterVersionData
      const version: ChapterVersionData = {
        id: dbVersion!.id,
        chapter_id: dbVersion!.chapter_id,
        content: dbVersion!.content,
        version_number: dbVersion!.version_number,
        change_summary: dbVersion!.summary || undefined,
        is_published: dbVersion!.is_published === 1,
        created_at: new Date(dbVersion!.created_at).getTime()
      }

      set((state) => ({
        currentVersion: version,
        versions: [version, ...state.versions],
        isSaving: false
      }))
      return version
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save version'
      set({ error: errorMsg, isSaving: false })
      throw error
    }
  },

  publishVersion: async (versionId: number) => {
    set({ isSaving: true, error: null })
    try {
      await db.publishVersion(versionId)
      set((state) => ({
        versions: state.versions.map(v => ({
          ...v,
          is_published: v.id === versionId
        })),
        currentVersion: state.currentVersion?.id === versionId
          ? { ...state.currentVersion, is_published: true }
          : state.currentVersion,
        isSaving: false
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to publish version'
      set({ error: errorMsg, isSaving: false })
    }
  },

  fetchVersions: async (chapterId: number) => {
    try {
      const latestVersion = await db.getLatestVersion(chapterId)
      if (latestVersion) {
        const version: ChapterVersionData = {
          id: latestVersion.id,
          chapter_id: latestVersion.chapter_id,
          content: latestVersion.content,
          version_number: latestVersion.version_number,
          change_summary: latestVersion.summary || undefined,
          is_published: latestVersion.is_published === 1,
          created_at: new Date(latestVersion.created_at).getTime()
        }
        set({ currentVersion: version, versions: [version] })
      } else {
        set({ currentVersion: null, versions: [] })
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error)
      set({ currentVersion: null, versions: [] })
    }
  },

  clearError: () => set({ error: null })
}))
