import { create } from 'zustand'
import { useBookStore } from './bookStore'
import { aiService, type AIProviderType } from '../services/aiService'

interface AppState {
  ollamaConnected: boolean
  availableModels: string[]
  selectedModel: string
  isCheckingConnection: boolean
  appError: string | null

  // AI Provider state
  activeProvider: AIProviderType
  providerConnections: {
    ollama: boolean
    lmstudio: boolean
  }

  // Actions
  checkOllamaConnection: () => Promise<void>
  listModels: () => Promise<void>
  setSelectedModel: (model: string) => void
  setAppError: (error: string | null) => void
  initializeApp: () => Promise<void>

  // AI Provider actions
  checkAllConnections: () => Promise<void>
  switchProvider: (provider: AIProviderType) => Promise<void>
  getActiveProvider: () => Promise<AIProviderType>
}

export const useAppStore = create<AppState>((set, get) => ({
  ollamaConnected: false,
  availableModels: [],
  selectedModel: '',
  isCheckingConnection: false,
  appError: null,

  // AI Provider state
  activeProvider: 'ollama',
  providerConnections: {
    ollama: false,
    lmstudio: false
  },

  checkOllamaConnection: async () => {
    set({ isCheckingConnection: true })
    try {
      const connected = await aiService.checkConnection()
      set({ ollamaConnected: connected, isCheckingConnection: false })
    } catch (error) {
      console.error('Failed to check AI connection:', error)
      set({ ollamaConnected: false, isCheckingConnection: false })
    }
  },

  listModels: async () => {
    try {
      const models = await aiService.listModels()
      set({
        availableModels: models,
        selectedModel: models[0] || ''
      })
    } catch (error) {
      console.error('Failed to list models:', error)
      set({ availableModels: [] })
    }
  },

  setSelectedModel: (model: string) => {
    set({ selectedModel: model })
    aiService.setModel(model)
  },

  setAppError: (error: string | null) => {
    set({ appError: error })
  },

  initializeApp: async () => {
    // Check all provider connections
    await get().checkAllConnections()

    // List available models for active provider
    const activeProvider = get().activeProvider
    const connected = get().providerConnections[activeProvider]
    if (connected) {
      await get().listModels()
    }

    // Load books
    const fetchBooks = useBookStore.getState().fetchBooks
    await fetchBooks()
  },

  // AI Provider actions
  checkAllConnections: async () => {
    set({ isCheckingConnection: true })
    try {
      const connections = await aiService.checkAllConnections()
      set({
        providerConnections: connections,
        ollamaConnected: connections.ollama,
        isCheckingConnection: false
      })
    } catch (error) {
      console.error('Failed to check connections:', error)
      set({
        providerConnections: { ollama: false, lmstudio: false },
        ollamaConnected: false,
        isCheckingConnection: false
      })
    }
  },

  switchProvider: async (provider: AIProviderType) => {
    try {
      aiService.switchProvider(provider)
      set({ activeProvider: provider })
      // Refresh models for new provider
      await get().listModels()
    } catch (error) {
      console.error('Failed to switch provider:', error)
    }
  },

  getActiveProvider: async () => {
    try {
      const provider = aiService.getActiveProvider()
      set({ activeProvider: provider })
      return provider
    } catch (error) {
      console.error('Failed to get active provider:', error)
      return get().activeProvider
    }
  }
}))
