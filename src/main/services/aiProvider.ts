/**
 * Unified AI Provider Interface
 * Supports multiple local AI backends (Ollama, LM Studio, etc.)
 */

export interface AIProviderConfig {
  baseUrl: string
  defaultModel: string
  timeout: number
  providerType: 'ollama' | 'lmstudio'
}

export interface BookIdea {
  title: string
  hook: string
  audience: string
  themes: string[]
  uniquenessAngle?: string
  emotionalTone?: string
}

export interface OutlineNode {
  id: string
  type: 'chapter' | 'section' | 'subsection'
  title: string
  description?: string
  children?: OutlineNode[]
  geniusMomentType?: 'insight' | 'contrarian' | 'synthesis' | 'metaphor' | 'story'
  emotionalArc?: 'curiosity' | 'building' | 'peak' | 'resolution' | 'twist'
}

export interface CreativeDirection {
  voice: 'conversational' | 'academic' | 'storytelling' | 'provocative'
  voiceCharacteristics?: string[]
  uniquenessAngle: {
    type: 'contrarian' | 'synthesis' | 'framework' | 'narrative' | 'research-backed'
    description: string
  }
  readerTransformation: {
    before: string
    after: string
  }
  emotionalJourney: {
    openingEmotion: 'curiosity' | 'frustration' | 'aspiration'
    peakEmotion: 'insight' | 'empowerment' | 'joy'
    closingEmotion: 'confidence' | 'inspiration' | 'urgency'
  }
  geniusMomentsPerChapter: 1 | 2 | 3
  competitiveDifferentiator: string
}

export interface AdvancedChapterPromptParams {
  chapterTitle: string
  chapterNumber: number
  topQuestions: any[]
  creativeDirection?: CreativeDirection
  previousChaptersSummary?: string
  openCuriosityGaps?: string[]
  bookContext?: {
    title: string
    niche: string
    overallTheme: string
  }
}

/**
 * Base interface that all AI providers must implement
 */
export interface IAIProvider {
  /**
   * Check if the provider service is running and accessible
   */
  checkConnection(): Promise<boolean>

  /**
   * List available models
   */
  listModels(): Promise<string[]>

  /**
   * Generate book ideas based on niche
   */
  generateBookIdeas(niche: string, count?: number): Promise<BookIdea[]>

  /**
   * Generate detailed outline
   */
  generateOutline(
    title: string,
    description: string,
    targetChapters?: number,
    creativeDirection?: CreativeDirection
  ): Promise<OutlineNode[]>

  /**
   * Generate writing prompts from reader feedback
   */
  generateChapterPrompt(chapterTitle: string, topQuestions: any[]): Promise<string>

  /**
   * Generate advanced chapter prompt with creative direction
   */
  generateAdvancedChapterPrompt(params: AdvancedChapterPromptParams): Promise<string>

  /**
   * Generic completion endpoint
   */
  complete(
    prompt: string,
    model?: string,
    temperature?: number,
    operationType?: string
  ): Promise<string>

  /**
   * Streaming completion for real-time text generation
   */
  completeStream(
    prompt: string,
    onChunk: (text: string) => void,
    model?: string,
    temperature?: number
  ): Promise<void>

  /**
   * Set the default model to use
   */
  setDefaultModel(model: string): void

  /**
   * Get performance report
   */
  getPerformanceReport(): string

  /**
   * Check if performance is degrading
   */
  isPerformanceDegrading(): boolean
}
