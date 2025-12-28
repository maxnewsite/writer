import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for API
export interface ElectronAPI {
  books: {
    create: (data: any) => Promise<any>
    getAll: () => Promise<any[]>
    getById: (id: number) => Promise<any>
    update: (id: number, data: any) => Promise<void>
    delete: (id: number) => Promise<void>
  }
  chapters: {
    create: (bookId: number, data: any) => Promise<any>
    getByBook: (bookId: number) => Promise<any[]>
    updateVersion: (chapterId: number, content: string, summary?: string) => Promise<any>
    publish: (versionId: number) => Promise<void>
    getLatestVersion: (chapterId: number) => Promise<any>
  }
  discussions: {
    createQuestion: (chapterId: number, text: string, authorName: string) => Promise<any>
    getQuestions: (chapterId: number, sortBy?: 'recent' | 'votes') => Promise<any[]>
    addAnswer: (questionId: number, text: string, isFromAuthor: boolean) => Promise<any>
    vote: (questionId: number, voterIdentifier: string) => Promise<void>
  }
  ollama: {
    checkConnection: () => Promise<boolean>
    listModels: () => Promise<string[]>
    generateIdeas: (niche: string, count: number) => Promise<any[]>
    generateOutline: (title: string, description: string, targetChapters?: number) => Promise<any>
    generateChapterPrompt: (chapterTitle: string, topQuestions: any[]) => Promise<string>
    setModel: (model: string) => Promise<void>
    onGenerationChunk: (callback: (text: string) => void) => () => void
  }
  ai: {
    checkAllConnections: () => Promise<{ ollama: boolean; lmstudio: boolean }>
    switchProvider: (providerType: 'ollama' | 'lmstudio') => Promise<{ success: boolean; error?: string }>
    getActiveProvider: () => Promise<'ollama' | 'lmstudio'>
    updateConfig: (config: any) => Promise<{ success: boolean; error?: string }>
    getConfig: () => Promise<any>
  }
  aiAudience: {
    generateInteraction: (
      chapterId: number,
      chapterTitle: string,
      chapterContent: string,
      config?: any
    ) => Promise<any>
    getPersonas: () => Promise<any[]>
    getPersona: (personaId: string) => Promise<any>
  }
  chapterDrafting: {
    generateDraft: (config: any) => Promise<string>
    generateFeedback: (chapterId: number, chapterTitle: string, chapterContent: string) => Promise<any>
    analyzeFeedback: (chapterId: number) => Promise<any>
    redraft: (config: any, originalDraft: string, feedback: any) => Promise<string>
    fullAIWriting: (bookId: number, bookTitle: string, bookDescription: string) => Promise<any>
  }
}

// Exposed API
const api: ElectronAPI = {
  books: {
    create: (data) => ipcRenderer.invoke('books:create', data),
    getAll: () => ipcRenderer.invoke('books:getAll'),
    getById: (id) => ipcRenderer.invoke('books:getById', id),
    update: (id, data) => ipcRenderer.invoke('books:update', id, data),
    delete: (id) => ipcRenderer.invoke('books:delete', id)
  },

  chapters: {
    create: (bookId, data) => ipcRenderer.invoke('chapters:create', bookId, data),
    getByBook: (bookId) => ipcRenderer.invoke('chapters:getByBook', bookId),
    updateVersion: (chapterId, content, summary) =>
      ipcRenderer.invoke('chapters:updateVersion', chapterId, content, summary),
    publish: (versionId) => ipcRenderer.invoke('chapters:publish', versionId),
    getLatestVersion: (chapterId) => ipcRenderer.invoke('chapters:getLatestVersion', chapterId)
  },

  discussions: {
    createQuestion: (chapterId, text, authorName) =>
      ipcRenderer.invoke('discussions:createQuestion', chapterId, text, authorName),
    getQuestions: (chapterId, sortBy) =>
      ipcRenderer.invoke('discussions:getQuestions', chapterId, sortBy),
    addAnswer: (questionId, text, isFromAuthor) =>
      ipcRenderer.invoke('discussions:addAnswer', questionId, text, isFromAuthor),
    vote: (questionId, voterIdentifier) =>
      ipcRenderer.invoke('discussions:vote', questionId, voterIdentifier)
  },

  ollama: {
    checkConnection: () => ipcRenderer.invoke('ollama:checkConnection'),
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    generateIdeas: (niche, count) => ipcRenderer.invoke('ollama:generateIdeas', niche, count),
    generateOutline: (bookIdea) => ipcRenderer.invoke('ollama:generateOutline', bookIdea),
    generateChapterPrompt: (chapterTitle, topQuestions) =>
      ipcRenderer.invoke('ollama:generateChapterPrompt', chapterTitle, topQuestions),
    setModel: (model) => ipcRenderer.invoke('ollama:setModel', model),
    onGenerationChunk: (callback) => {
      ipcRenderer.on('ollama:chunk', (_, text) => callback(text))
      return () => ipcRenderer.removeAllListeners('ollama:chunk')
    }
  },

  ai: {
    checkAllConnections: () => ipcRenderer.invoke('ai:checkAllConnections'),
    switchProvider: (providerType) => ipcRenderer.invoke('ai:switchProvider', providerType),
    getActiveProvider: () => ipcRenderer.invoke('ai:getActiveProvider'),
    updateConfig: (config) => ipcRenderer.invoke('ai:updateConfig', config),
    getConfig: () => ipcRenderer.invoke('ai:getConfig')
  },

  aiAudience: {
    generateInteraction: (chapterId, chapterTitle, chapterContent, config) =>
      ipcRenderer.invoke('ai-audience:generate-interaction', chapterId, chapterTitle, chapterContent, config),
    getPersonas: () => ipcRenderer.invoke('ai-audience:get-personas'),
    getPersona: (personaId) => ipcRenderer.invoke('ai-audience:get-persona', personaId)
  },

  chapterDrafting: {
    generateDraft: (config) => ipcRenderer.invoke('chapter-drafting:generate-draft', config),
    generateFeedback: (chapterId, chapterTitle, chapterContent) =>
      ipcRenderer.invoke('chapter-drafting:generate-feedback', chapterId, chapterTitle, chapterContent),
    analyzeFeedback: (chapterId) => ipcRenderer.invoke('chapter-drafting:analyze-feedback', chapterId),
    redraft: (config, originalDraft, feedback) =>
      ipcRenderer.invoke('chapter-drafting:redraft', config, originalDraft, feedback),
    fullAIWriting: (bookId, bookTitle, bookDescription) =>
      ipcRenderer.invoke('chapter-drafting:full-ai-writing', bookId, bookTitle, bookDescription)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: ElectronAPI
  }
}
