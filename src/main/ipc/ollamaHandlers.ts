import { ipcMain } from 'electron'
import { AIServiceManager, type AIProviderType, type AIServiceConfig } from '../services/aiServiceManager'

let aiServiceManager: AIServiceManager | null = null

export function registerOllamaHandlers(): void {
  // Initialize service manager on first use
  const getServiceManager = () => {
    if (!aiServiceManager) {
      aiServiceManager = new AIServiceManager()
    }
    return aiServiceManager
  }

  ipcMain.handle('ollama:checkConnection', async () => {
    try {
      return await getServiceManager().checkConnection()
    } catch (error) {
      console.error('Check connection failed:', error)
      return false
    }
  })

  ipcMain.handle('ollama:listModels', async () => {
    try {
      return await getServiceManager().listModels()
    } catch (error) {
      console.error('List models failed:', error)
      return []
    }
  })

  ipcMain.handle('ollama:generateIdeas', async (_, niche: string, count: number = 5) => {
    try {
      return await getServiceManager().generateBookIdeas(niche, count)
    } catch (error) {
      console.error('Generate ideas failed:', error)
      return { error: String(error) }
    }
  })

  ipcMain.handle('ollama:generateOutline', async (_, title: string, description: string, targetChapters: number = 10) => {
    try {
      return await getServiceManager().generateOutline(title, description, targetChapters)
    } catch (error) {
      console.error('Generate outline failed:', error)
      return { error: String(error) }
    }
  })

  ipcMain.handle('ollama:generateChapterPrompt', async (_, chapterTitle: string, topQuestions: any[]) => {
    try {
      return await getServiceManager().generateChapterPrompt(chapterTitle, topQuestions)
    } catch (error) {
      console.error('Generate chapter prompt failed:', error)
      return ''
    }
  })

  ipcMain.handle('ollama:setModel', async (_, model: string) => {
    try {
      getServiceManager().setDefaultModel(model)
    } catch (error) {
      console.error('Set model failed:', error)
    }
  })

  // New handlers for provider management
  ipcMain.handle('ai:checkAllConnections', async () => {
    try {
      return await getServiceManager().checkAllConnections()
    } catch (error) {
      console.error('Check all connections failed:', error)
      return { ollama: false, lmstudio: false }
    }
  })

  ipcMain.handle('ai:switchProvider', async (_, providerType: AIProviderType) => {
    try {
      getServiceManager().switchProvider(providerType)
      return { success: true }
    } catch (error) {
      console.error('Switch provider failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('ai:getActiveProvider', async () => {
    try {
      return getServiceManager().getActiveProviderType()
    } catch (error) {
      console.error('Get active provider failed:', error)
      return 'ollama'
    }
  })

  ipcMain.handle('ai:updateConfig', async (_, config: Partial<AIServiceConfig>) => {
    try {
      getServiceManager().updateConfig(config)
      return { success: true }
    } catch (error) {
      console.error('Update config failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('ai:getConfig', async () => {
    try {
      return getServiceManager().getConfig()
    } catch (error) {
      console.error('Get config failed:', error)
      return null
    }
  })
}
