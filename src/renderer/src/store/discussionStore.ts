import { create } from 'zustand'
import { db } from '../services/database'

export interface QuestionData {
  id: number
  chapter_id: number
  text: string
  author_name: string
  vote_count: number
  status: 'open' | 'answered' | 'incorporated'
  created_at: number
}

export interface AnswerData {
  id: number
  question_id: number
  text: string
  is_from_author: boolean
  created_at: number
}

export interface QuestionWithAnswers extends QuestionData {
  answers?: AnswerData[]
}

type SortBy = 'votes' | 'recent'

interface DiscussionState {
  questions: QuestionWithAnswers[]
  sortBy: SortBy
  isLoading: boolean
  isSaving: boolean
  error: string | null
  voterIdentifier: string // Simple device/user identifier for voting

  // Actions
  fetchQuestions: (chapterId: number, sortBy?: SortBy) => Promise<void>
  createQuestion: (chapterId: number, text: string, authorName: string) => Promise<QuestionWithAnswers>
  addAnswer: (questionId: number, text: string, isFromAuthor?: boolean) => Promise<void>
  vote: (questionId: number) => Promise<void>
  setSortBy: (sortBy: SortBy) => void
  getTopQuestions: (limit?: number) => QuestionWithAnswers[]
  clearError: () => void
}

// Generate a simple voter identifier (device-based)
const generateVoterIdentifier = (): string => {
  let identifier = localStorage.getItem('voter_id')
  if (!identifier) {
    identifier = `voter_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem('voter_id', identifier)
  }
  return identifier
}

export const useDiscussionStore = create<DiscussionState>((set, get) => ({
  questions: [],
  sortBy: 'votes',
  isLoading: false,
  isSaving: false,
  error: null,
  voterIdentifier: generateVoterIdentifier(),

  fetchQuestions: async (chapterId: number, sortBy: SortBy = 'votes') => {
    set({ isLoading: true, error: null, sortBy })
    try {
      const dbQuestions = await db.getQuestionsByChapter(chapterId, sortBy)
      // Map database schema to QuestionData
      const questions: QuestionWithAnswers[] = dbQuestions.map(q => ({
        id: q.id,
        chapter_id: q.chapter_id,
        text: q.text,
        author_name: q.author_name,
        vote_count: q.vote_count,
        status: 'open' as const,
        created_at: new Date(q.created_at).getTime(),
        answers: []
      }))
      set({ questions, isLoading: false })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch questions'
      set({ error: errorMsg, isLoading: false })
    }
  },

  createQuestion: async (chapterId: number, text: string, authorName: string) => {
    set({ isSaving: true, error: null })
    try {
      const dbQuestion = await db.createQuestion({
        chapter_id: chapterId,
        text,
        author_name: authorName,
        vote_count: 0,
        created_at: new Date().toISOString()
      })

      const question: QuestionWithAnswers = {
        id: dbQuestion!.id,
        chapter_id: dbQuestion!.chapter_id,
        text: dbQuestion!.text,
        author_name: dbQuestion!.author_name,
        vote_count: dbQuestion!.vote_count,
        status: 'open',
        created_at: new Date(dbQuestion!.created_at).getTime(),
        answers: []
      }

      set((state) => ({
        questions: [question, ...state.questions],
        isSaving: false
      }))

      return question
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create question'
      set({ error: errorMsg, isSaving: false })
      throw error
    }
  },

  addAnswer: async (questionId: number, text: string, isFromAuthor: boolean = false) => {
    set({ isSaving: true, error: null })
    try {
      const dbAnswer = await db.createAnswer({
        question_id: questionId,
        text,
        is_from_author: isFromAuthor ? 1 : 0,
        created_at: new Date().toISOString()
      })

      const answer: AnswerData = {
        id: dbAnswer!.id,
        question_id: dbAnswer!.question_id,
        text: dbAnswer!.text,
        is_from_author: dbAnswer!.is_from_author === 1,
        created_at: new Date(dbAnswer!.created_at).getTime()
      }

      set((state) => ({
        questions: state.questions.map(q =>
          q.id === questionId
            ? {
              ...q,
              answers: [...(q.answers || []), answer]
            }
            : q
        ),
        isSaving: false
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to add answer'
      set({ error: errorMsg, isSaving: false })
      throw error
    }
  },

  vote: async (questionId: number) => {
    try {
      const voterIdentifier = get().voterIdentifier
      await db.addVote(questionId, voterIdentifier)

      // Update vote count locally
      set((state) => ({
        questions: state.questions.map(q =>
          q.id === questionId
            ? { ...q, vote_count: q.vote_count + 1 }
            : q
        )
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to vote'
      // If already voted, just ignore the error
      if (!errorMsg.includes('Already voted')) {
        set({ error: errorMsg })
      }
    }
  },

  setSortBy: (sortBy: SortBy) => {
    set({ sortBy })
  },

  getTopQuestions: (limit: number = 5): QuestionWithAnswers[] => {
    const { questions } = get()
    return questions
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, limit)
  },

  clearError: () => set({ error: null })
}))
