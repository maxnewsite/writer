import { PerformanceTracker } from './performanceTracker'
import { GracefulFallbackService, type FallbackResult } from './gracefulFallbackService'
import type {
  IAIProvider,
  AIProviderConfig,
  BookIdea,
  OutlineNode,
  CreativeDirection,
  AdvancedChapterPromptParams
} from './aiProvider'

/**
 * LM Studio Service - OpenAI-compatible local AI server
 * Default endpoint: http://localhost:1234
 */
export class LMStudioService implements IAIProvider {
  private config: AIProviderConfig
  private performanceTracker: PerformanceTracker
  private fallbackService: GracefulFallbackService
  private recentFailures: number = 0

  constructor(baseUrl: string = 'http://127.0.0.1:1234', defaultModel: string = '') {
    this.config = {
      baseUrl,
      defaultModel,
      timeout: 240000,  // 4 minutes
      providerType: 'lmstudio'
    }
    this.performanceTracker = new PerformanceTracker()
    this.fallbackService = new GracefulFallbackService()
  }

  /**
   * Check if LM Studio server is running
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.error('LM Studio connection failed:', error)
      return false
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id)
      }
      return []
    } catch (error) {
      console.error('Error listing LM Studio models:', error)
      throw new Error('Failed to list LM Studio models')
    }
  }

  /**
   * Generate book ideas based on niche
   */
  async generateBookIdeas(niche: string, count: number = 5): Promise<BookIdea[]> {
    const ideas: BookIdea[] = []

    try {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const prompt = this.getPromptTemplate('singleBookIdea', { niche, number: i + 1 })
        const result = await this.complete(prompt, this.config.defaultModel, 0.85)
        const idea = this.parseSingleBookIdea(result, niche)
        if (idea) {
          ideas.push(idea)
        }
      }
      return ideas
    } catch (error) {
      console.error('Error generating book ideas:', error)
      throw new Error('Failed to generate book ideas')
    }
  }

  /**
   * Generate detailed outline
   */
  async generateOutline(
    title: string,
    description: string,
    targetChapters: number = 10,
    creativeDirection?: CreativeDirection
  ): Promise<OutlineNode[]> {
    try {
      const chapters: OutlineNode[] = []
      const chapterCount = Math.min(targetChapters, 8)
      const listPrompt = this.getPromptTemplate('outlineList', {
        title,
        description,
        targetChapters: chapterCount,
        creativeDirection
      })

      console.log(`[LM Studio] Generating ${chapterCount} chapter titles...`)
      const chapterListResult = await this.complete(listPrompt, this.config.defaultModel, 0.75)
      const chapterTitles = this.parseChapterList(chapterListResult, chapterCount)

      console.log(`[LM Studio] Generated ${chapterTitles.length} chapters`)

      for (let i = 0; i < chapterTitles.length; i++) {
        chapters.push({
          id: `ch-${i + 1}`,
          type: 'chapter',
          title: chapterTitles[i],
          description: `Chapter ${i + 1} content`,
          geniusMomentType: this.getGeniusMomentType(i, chapterTitles.length),
          emotionalArc: this.getEmotionalArc(i, chapterTitles.length),
          children: []
        })
      }

      return chapters
    } catch (error) {
      console.error('Error generating outline:', error)
      throw new Error('Failed to generate outline')
    }
  }

  /**
   * Generate advanced chapter prompt
   */
  async generateAdvancedChapterPrompt(params: AdvancedChapterPromptParams): Promise<string> {
    const prompt = this.getPromptTemplate('advancedChapterPrompt', params)
    try {
      return await this.complete(prompt, this.config.defaultModel, 0.8)
    } catch (error) {
      console.error('Error generating chapter prompt:', error)
      throw new Error('Failed to generate chapter prompt')
    }
  }

  /**
   * Legacy chapter prompt for backwards compatibility
   */
  async generateChapterPrompt(chapterTitle: string, topQuestions: any[]): Promise<string> {
    return this.generateAdvancedChapterPrompt({
      chapterTitle,
      chapterNumber: 0,
      topQuestions
    })
  }

  /**
   * Generic completion using OpenAI-compatible chat API
   */
  async complete(
    prompt: string,
    model: string = this.config.defaultModel,
    temperature: number = 0.7,
    operationType: string = 'section'
  ): Promise<string> {
    const adaptiveTimeout = this.performanceTracker.getRecommendedTimeout(model, operationType)
    console.log(`[LM Studio] Adaptive timeout: ${(adaptiveTimeout / 1000).toFixed(1)}s`)

    const primaryOperation = async (): Promise<string> => {
      return this.completeWithTimeout(prompt, model, temperature, adaptiveTimeout, operationType)
    }

    const result: FallbackResult<string> = await this.fallbackService.executeWithFallback(
      `${model} ${operationType}`,
      primaryOperation,
      {
        maxRetries: 3,
        strategies: ['retry', 'reduce_length', 'minimal'],
        emergencyMode: this.recentFailures >= 3
      }
    )

    this.fallbackService.logFallbackUsage(result, `${model} ${operationType}`)

    if (!result.success) {
      console.error(`🆘 EMERGENCY: All strategies failed, generating minimal fallback content`)
      this.recentFailures++
      return this.generateEmergencyContent(operationType, prompt)
    }

    if (result.strategyUsed === 'primary') {
      this.recentFailures = 0
    }

    return result.data!
  }

  /**
   * Core completion with timeout using OpenAI chat format
   */
  private async completeWithTimeout(
    prompt: string,
    model: string,
    temperature: number,
    timeout: number,
    operationType: string
  ): Promise<string> {
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      console.log(`[LM Studio] Starting generation with model ${model}, temp ${temperature}`)

      // Use the loaded model if no specific model is set
      const modelToUse = model || 'local-model'

      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          max_tokens: 512,
          stream: false
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (!response.ok) {
        this.performanceTracker.recordOperation(model, operationType, duration, false)
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      const result = data.choices?.[0]?.message?.content || ''

      this.performanceTracker.recordOperation(
        model,
        operationType,
        duration,
        true,
        result.length
      )

      console.log(`[LM Studio] ✅ Generation completed in ${(duration / 1000).toFixed(2)}s`)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.performanceTracker.recordOperation(model, operationType, duration, false)
      console.error(`[LM Studio] ❌ Error after ${(duration / 1000).toFixed(2)}s:`, error)
      throw error
    }
  }

  /**
   * Streaming completion using OpenAI chat format
   */
  async completeStream(
    prompt: string,
    onChunk: (text: string) => void,
    model: string = this.config.defaultModel,
    temperature: number = 0.7
  ): Promise<void> {
    try {
      const modelToUse = model || 'local-model'

      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '))

        for (const line of lines) {
          const data = line.replace('data: ', '')
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              onChunk(content)
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      console.error('Error in streaming completion:', error)
      throw error
    }
  }

  /**
   * Set default model
   */
  setDefaultModel(model: string): void {
    this.config.defaultModel = model
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    return this.performanceTracker.getPerformanceReport(this.config.defaultModel)
  }

  /**
   * Check if performance is degrading
   */
  isPerformanceDegrading(): boolean {
    return this.performanceTracker.isPerformanceDegrading(this.config.defaultModel)
  }

  // ===== Private Helper Methods =====

  private getGeniusMomentType(index: number, total: number): 'insight' | 'contrarian' | 'synthesis' | 'metaphor' | 'story' {
    const types: Array<'insight' | 'contrarian' | 'synthesis' | 'metaphor' | 'story'> =
      ['insight', 'contrarian', 'synthesis', 'metaphor', 'story']
    return types[index % types.length]
  }

  private getEmotionalArc(index: number, total: number): 'curiosity' | 'building' | 'peak' | 'resolution' | 'twist' {
    const progress = index / (total - 1)
    if (progress < 0.2) return 'curiosity'
    if (progress < 0.5) return 'building'
    if (progress < 0.7) return 'peak'
    if (progress < 0.9) return 'resolution'
    return 'twist'
  }

  private generateEmergencyContent(operationType: string, prompt: string): string {
    const topicMatch = prompt.match(/(?:CHAPTER|TOPIC|TITLE):\s*"?([^"\n]+)"?/i)
    const topic = topicMatch ? topicMatch[1] : 'the subject matter'
    return this.fallbackService.generateEmergencyContent(operationType, topic)
  }

  private getPromptTemplate(templateName: string, params: Record<string, any>): string {
    // Reuse the same prompt templates from OllamaService
    const templates: Record<string, (params: Record<string, any>) => string> = {
      singleBookIdea: (p) => `Generate one creative book idea for the "${p.niche}" niche.

Requirements:
- Fresh, memorable concept
- Commercially viable
- Specific target audience

Provide in this format:
TITLE: [Catchy, provocative title]
HOOK: [2-3 sentences explaining why readers need this]
AUDIENCE: [Specific target readers]
THEMES: [3-5 key topics, comma separated]
UNIQUE: [What makes this different from other books]
TONE: [Primary emotion: empowered/enlightened/entertained]`,

      outlineList: (p) => `Create ${p.targetChapters} compelling chapter titles for a book.

Book Title: "${p.title}"
Description: ${p.description}

Requirements:
- Clear, engaging chapter titles
- Logical progression
- Build momentum throughout
${p.creativeDirection ? `- Voice: ${p.creativeDirection.voice}` : ''}

Format: List each chapter title on a new line, numbered 1-${p.targetChapters}.
Example:
1. Chapter Title One
2. Chapter Title Two
3. Chapter Title Three

Only output the numbered list, nothing else.`,

      advancedChapterPrompt: (p: Record<string, any>) => {
        const questionsText = p.topQuestions
          .map((q: any, i: number) => `${i + 1}. ${q.text} (${q.vote_count} votes)`)
          .join('\n')

        const contextText = p.bookContext ? `
BOOK CONTEXT:
- Title: "${p.bookContext.title}"
- Niche: ${p.bookContext.niche}
- Overall Theme: ${p.bookContext.overallTheme}
` : ''

        const previousText = p.previousChaptersSummary ? `
PREVIOUS CHAPTERS MOMENTUM:
${p.previousChaptersSummary}
` : ''

        const curiosityText = p.openCuriosityGaps && p.openCuriosityGaps.length > 0 ? `
OPEN CURIOSITY GAPS (from previous chapters):
${p.openCuriosityGaps.join('\n')}
` : ''

        const voiceText = p.creativeDirection ? `
VOICE & STYLE:
- Maintain ${p.creativeDirection.voice} voice
- Characteristics: ${p.creativeDirection.voiceCharacteristics?.join(', ') || 'engaging, clear'}
` : ''

        return `You are a creative writing coach helping craft a memorable chapter.

CHAPTER: "${p.chapterTitle}" (Chapter ${p.chapterNumber})
${contextText}${previousText}${voiceText}
TOP READER QUESTIONS (what they want to know):
${questionsText}
${curiosityText}

YOUR TASK: Create a writing prompt that will produce a chapter readers can't stop thinking about.

GENIUS MOMENT REQUIREMENTS (${p.creativeDirection?.geniusMomentsPerChapter || 2} required):
Generate ${p.creativeDirection?.geniusMomentsPerChapter || 2} "I never thought of it that way" moments:
1. CONTRARIAN INSIGHT - Challenge a widely accepted assumption in this space
2. UNEXPECTED SYNTHESIS - Connect two seemingly unrelated concepts
3. VIVID METAPHOR/STORY - Make abstract ideas concrete and memorable

STRUCTURE YOUR PROMPT AS:
═══════════════════════════════════════════════════════════════
🎯 HOOK (Opening Curiosity Gap)
- What question will grab readers in the first paragraph?
- What tension will make them NEED to read on?

💡 GENIUS MOMENTS (${p.creativeDirection?.geniusMomentsPerChapter || 2} strategic placements)
1. [Type: Contrarian/Synthesis/Story] at [Opening/Middle/Climax]
   - The insight: [specific idea]
   - Why it's memorable: [makes readers rethink X]

2. [Type] at [placement]
   - The insight: [specific idea]
   - Why it's memorable: [emotional impact]

📚 KEY SECTIONS (3-5 sections)
Section 1: [Title]
- Purpose: [what it delivers]
- Reader Questions Addressed: [specific questions from list]
- Transition: [how it builds to next section]

Section 2: [Title]
...

🔄 CLIFFHANGER / FORWARD MOMENTUM
- What question should remain unanswered?
- What tension sets up the next chapter?
- What have we promised to deliver next?

⚠️ AVOID:
- Generic advice readers have heard 100 times
- Predictable structure without surprise
- Flat, academic tone (unless specifically requested)
- Answering all questions (leave some mystery!)
═══════════════════════════════════════════════════════════════

Provide specific, actionable guidance that will help the author write something MEMORABLE.`
      }
    }

    return templates[templateName]?.(params) || ''
  }

  private parseSingleBookIdea(text: string, niche: string): BookIdea | null {
    try {
      const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i)
      const hookMatch = text.match(/HOOK:\s*(.+?)(?:\n(?:AUDIENCE|THEMES|UNIQUE|TONE):|$)/is)
      const audienceMatch = text.match(/AUDIENCE:\s*(.+?)(?:\n|$)/i)
      const themesMatch = text.match(/THEMES:\s*(.+?)(?:\n|$)/i)
      const uniqueMatch = text.match(/UNIQUE:\s*(.+?)(?:\n|$)/is)
      const toneMatch = text.match(/TONE:\s*(.+?)(?:\n|$)/i)

      if (!titleMatch || !hookMatch) {
        console.warn('Could not parse book idea from response')
        return null
      }

      const themesText = themesMatch?.[1] || ''
      const themes = themesText.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5)

      return {
        title: titleMatch[1].trim(),
        hook: hookMatch[1].trim(),
        audience: audienceMatch?.[1].trim() || `${niche} enthusiasts`,
        themes: themes.length > 0 ? themes : [niche, 'personal growth', 'success'],
        uniquenessAngle: uniqueMatch?.[1].trim() || 'Fresh perspective on ' + niche,
        emotionalTone: toneMatch?.[1].trim() || 'empowered'
      }
    } catch (error) {
      console.error('Error parsing single book idea:', error)
      return null
    }
  }

  private parseChapterList(text: string, expectedCount: number): string[] {
    try {
      const chapters: string[] = []
      const lines = text.split('\n')

      for (const line of lines) {
        const match = line.match(/^\s*\d+[\.)]\s*(.+)$/i)
        if (match) {
          const title = match[1].trim()
          if (title && title.length > 3) {
            chapters.push(title)
          }
        }
      }

      if (chapters.length < expectedCount / 2) {
        console.warn('Could not parse enough chapters, using fallback')
        const fallbackChapters = []
        for (let i = 0; i < expectedCount; i++) {
          fallbackChapters.push(`Chapter ${i + 1}: Introduction to Key Concepts`)
        }
        return fallbackChapters
      }

      return chapters.slice(0, expectedCount)
    } catch (error) {
      console.error('Error parsing chapter list:', error)
      const fallbackChapters = []
      for (let i = 0; i < expectedCount; i++) {
        fallbackChapters.push(`Chapter ${i + 1}`)
      }
      return fallbackChapters
    }
  }
}
