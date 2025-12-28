import { OllamaService } from './ollamaService'
import { LMStudioService } from './lmStudioService'
import type { IAIProvider } from './aiProvider'

export type AIProviderType = 'ollama' | 'lmstudio'

export interface AIServiceConfig {
  providerType: AIProviderType
  ollamaUrl?: string
  ollamaModel?: string
  lmstudioUrl?: string
  lmstudioModel?: string
}

/**
 * Unified AI Service Manager
 * Manages multiple AI providers (Ollama, LM Studio) and switches between them
 */
export class AIServiceManager {
  private providers: Map<AIProviderType, IAIProvider>
  private activeProvider: AIProviderType
  private config: AIServiceConfig

  constructor(config?: AIServiceConfig) {
    this.config = config || {
      providerType: 'ollama',
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.1:8b',
      lmstudioUrl: 'http://127.0.0.1:1234',
      lmstudioModel: ''
    }

    this.providers = new Map()
    this.activeProvider = this.config.providerType

    // Initialize providers lazily
    this.initializeProvider(this.activeProvider)
  }

  /**
   * Initialize a specific provider
   */
  private initializeProvider(type: AIProviderType): void {
    if (this.providers.has(type)) {
      return
    }

    switch (type) {
      case 'ollama':
        this.providers.set('ollama', new OllamaService(
          this.config.ollamaUrl,
          this.config.ollamaModel
        ))
        break
      case 'lmstudio':
        this.providers.set('lmstudio', new LMStudioService(
          this.config.lmstudioUrl,
          this.config.lmstudioModel
        ))
        break
    }
  }

  /**
   * Get the currently active provider
   */
  getActiveProvider(): IAIProvider {
    const provider = this.providers.get(this.activeProvider)
    if (!provider) {
      throw new Error(`Provider ${this.activeProvider} not initialized`)
    }
    return provider
  }

  /**
   * Get a specific provider (initializes if needed)
   */
  getProvider(type: AIProviderType): IAIProvider {
    this.initializeProvider(type)
    const provider = this.providers.get(type)
    if (!provider) {
      throw new Error(`Failed to initialize provider ${type}`)
    }
    return provider
  }

  /**
   * Switch to a different provider
   */
  switchProvider(type: AIProviderType): void {
    this.initializeProvider(type)
    this.activeProvider = type
    console.log(`[AIServiceManager] Switched to provider: ${type}`)
  }

  /**
   * Get current provider type
   */
  getActiveProviderType(): AIProviderType {
    return this.activeProvider
  }

  /**
   * Check connection for all providers
   */
  async checkAllConnections(): Promise<Record<AIProviderType, boolean>> {
    const results: Record<AIProviderType, boolean> = {
      ollama: false,
      lmstudio: false
    }

    const types: AIProviderType[] = ['ollama', 'lmstudio']

    for (const type of types) {
      try {
        this.initializeProvider(type)
        const provider = this.providers.get(type)
        if (provider) {
          results[type] = await provider.checkConnection()
        }
      } catch (error) {
        console.error(`[AIServiceManager] Error checking ${type}:`, error)
        results[type] = false
      }
    }

    return results
  }

  /**
   * Check connection for active provider
   */
  async checkConnection(): Promise<boolean> {
    return this.getActiveProvider().checkConnection()
  }

  /**
   * List models from active provider
   */
  async listModels(): Promise<string[]> {
    return this.getActiveProvider().listModels()
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config }

    // If provider type changed, switch to it
    if (config.providerType && config.providerType !== this.activeProvider) {
      this.switchProvider(config.providerType)
    }

    // Reinitialize providers if their URLs/models changed
    if (config.ollamaUrl || config.ollamaModel) {
      this.providers.delete('ollama')
      this.initializeProvider('ollama')
    }
    if (config.lmstudioUrl || config.lmstudioModel) {
      this.providers.delete('lmstudio')
      this.initializeProvider('lmstudio')
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AIServiceConfig {
    return { ...this.config }
  }

  // Proxy methods to active provider

  async generateBookIdeas(niche: string, count?: number) {
    return this.getActiveProvider().generateBookIdeas(niche, count)
  }

  async generateOutline(
    title: string,
    description: string,
    targetChapters?: number,
    creativeDirection?: any
  ) {
    return this.getActiveProvider().generateOutline(title, description, targetChapters, creativeDirection)
  }

  async generateChapterPrompt(chapterTitle: string, topQuestions: any[]) {
    return this.getActiveProvider().generateChapterPrompt(chapterTitle, topQuestions)
  }

  async generateAdvancedChapterPrompt(params: any) {
    return this.getActiveProvider().generateAdvancedChapterPrompt(params)
  }

  async complete(prompt: string, model?: string, temperature?: number, operationType?: string) {
    return this.getActiveProvider().complete(prompt, model, temperature, operationType)
  }

  async completeStream(
    prompt: string,
    onChunk: (text: string) => void,
    model?: string,
    temperature?: number
  ) {
    return this.getActiveProvider().completeStream(prompt, onChunk, model, temperature)
  }

  setDefaultModel(model: string) {
    return this.getActiveProvider().setDefaultModel(model)
  }

  getPerformanceReport() {
    return this.getActiveProvider().getPerformanceReport()
  }

  isPerformanceDegrading() {
    return this.getActiveProvider().isPerformanceDegrading()
  }
}
