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

interface GeniusMoment {
  type: 'insight' | 'contrarian' | 'synthesis' | 'metaphor' | 'story'
  suggestion: string
  placement: 'opening' | 'middle' | 'climax' | 'resolution'
  rationale: string
}

interface PromptRefinementOptions {
  tone?: 'more-provocative' | 'more-accessible' | 'more-academic' | 'more-storytelling'
  focus?: 'narrow-to-question' | 'broaden-context' | 'add-examples' | 'add-research'
  geniusMomentType?: 'insight' | 'contrarian' | 'synthesis' | 'metaphor' | 'story'
  creativity?: number  // 1-10, affects temperature
}

interface ContentAnalysis {
  readabilityScore: number
  emotionalTone: string[]
  uniquenessIndicators: string[]
  curiosityGaps: string[]
  geniusMomentCandidates: { position: number, type: string, text: string }[]
  improvementSuggestions: string[]
}

export class OllamaService implements IAIProvider {
  private config: AIProviderConfig
  private performanceTracker: PerformanceTracker
  private fallbackService: GracefulFallbackService
  private recentFailures: number = 0

  constructor(baseUrl: string = 'http://127.0.0.1:11434', defaultModel: string = 'llama3.1:8b') {
    this.config = {
      baseUrl,
      defaultModel,
      timeout: 240000,  // 4 minutes - base timeout, will be adapted dynamically
      providerType: 'ollama'
    }
    this.performanceTracker = new PerformanceTracker()
    this.fallbackService = new GracefulFallbackService()
  }

  /**
   * Check if Ollama server is running and accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.error('Ollama connection failed:', error)
      return false
    }
  }

  /**
   * List available models on the local Ollama instance
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m: any) => m.name)
      }
      return []
    } catch (error) {
      console.error('Error listing models:', error)
      throw new Error('Failed to list Ollama models')
    }
  }

  /**
   * Generate book ideas based on niche - HIGH CREATIVITY
   */
  async generateBookIdeas(niche: string, count: number = 5): Promise<BookIdea[]> {
    const ideas: BookIdea[] = []

    try {
      // Generate ideas one at a time for better reliability
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
   * Generate detailed outline with creative direction
   */
  async generateOutline(
    title: string,
    description: string,
    targetChapters: number = 10,
    creativeDirection?: CreativeDirection
  ): Promise<OutlineNode[]> {
    try {
      const chapters: OutlineNode[] = []

      // Generate simplified chapter list
      const chapterCount = Math.min(targetChapters, 8) // Limit to 8 chapters for reliability
      const listPrompt = this.getPromptTemplate('outlineList', {
        title,
        description,
        targetChapters: chapterCount,
        creativeDirection
      })

      console.log(`[Ollama] Generating ${chapterCount} chapter titles...`)
      const chapterListResult = await this.complete(listPrompt, this.config.defaultModel, 0.75)
      const chapterTitles = this.parseChapterList(chapterListResult, chapterCount)

      console.log(`[Ollama] Generated ${chapterTitles.length} chapters, creating outline nodes...`)

      // Create outline nodes with basic structure
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

  /**
   * Generate ADVANCED writing prompts from reader feedback
   */
  async generateAdvancedChapterPrompt(
    params: AdvancedChapterPromptParams
  ): Promise<string> {
    const prompt = this.getPromptTemplate('advancedChapterPrompt', params)

    try {
      // High temperature for creative prompting
      return await this.complete(prompt, this.config.defaultModel, 0.8)
    } catch (error) {
      console.error('Error generating chapter prompt:', error)
      throw new Error('Failed to generate chapter prompt')
    }
  }

  /**
   * Generate genius moment suggestions for a chapter
   */
  async generateGeniusMoments(
    chapterTitle: string,
    chapterContent: string,
    desiredCount: number = 2,
    voice: string = 'conversational'
  ): Promise<GeniusMoment[]> {
    const prompt = this.getPromptTemplate('geniusMoments', {
      chapterTitle,
      chapterContent,
      desiredCount,
      voice
    })

    try {
      const result = await this.complete(prompt, this.config.defaultModel, 0.85)
      return this.parseGeniusMoments(result)
    } catch (error) {
      console.error('Error generating genius moments:', error)
      return []
    }
  }

  /**
   * Analyze content quality and provide feedback
   */
  async analyzeContentQuality(content: string): Promise<ContentAnalysis> {
    const prompt = this.getPromptTemplate('contentAnalysis', { content })

    try {
      // Lower temperature for analytical precision
      const result = await this.complete(prompt, this.config.defaultModel, 0.5)
      return this.parseContentAnalysis(result)
    } catch (error) {
      console.error('Error analyzing content:', error)
      throw new Error('Failed to analyze content')
    }
  }

  /**
   * Refine a generated prompt based on user preferences
   */
  async refinePrompt(
    originalPrompt: string,
    refinement: PromptRefinementOptions
  ): Promise<string> {
    const prompt = this.getPromptTemplate('refinePrompt', { originalPrompt, refinement })

    try {
      // Temperature based on creativity setting
      const temp = refinement.creativity ? 0.5 + (refinement.creativity / 20) : 0.7
      return await this.complete(prompt, this.config.defaultModel, temp)
    } catch (error) {
      console.error('Error refining prompt:', error)
      throw new Error('Failed to refine prompt')
    }
  }

  /**
   * Generate counter-arguments for debate (AI Devil's Advocate)
   */
  async generateCounterArgument(
    question: string,
    authorAnswer: string,
    persona: 'skeptic' | 'advocate' | 'socratic' = 'skeptic'
  ): Promise<string> {
    const prompt = this.getPromptTemplate('counterArgument', {
      question,
      authorAnswer,
      persona
    })

    try {
      return await this.complete(prompt, this.config.defaultModel, 0.7)
    } catch (error) {
      console.error('Error generating counter-argument:', error)
      throw new Error('Failed to generate counter-argument')
    }
  }

  /**
   * Synthesize debate threads into insights
   */
  async synthesizeDebate(
    question: string,
    positions: string[]
  ): Promise<{
    convergencePoints: string[]
    productiveTensions: string[]
    newInsights: string[]
    chapterIdeas: string[]
  }> {
    const prompt = this.getPromptTemplate('synthesizeDebate', { question, positions })

    try {
      const result = await this.complete(prompt, this.config.defaultModel, 0.7)
      return this.parseDebateSynthesis(result)
    } catch (error) {
      console.error('Error synthesizing debate:', error)
      throw new Error('Failed to synthesize debate')
    }
  }

  /**
   * LEGACY: Simple chapter prompt (for backwards compatibility)
   */
  async generateChapterPrompt(chapterTitle: string, topQuestions: any[]): Promise<string> {
    // Delegate to advanced version with minimal params
    return this.generateAdvancedChapterPrompt({
      chapterTitle,
      chapterNumber: 0,
      topQuestions
    })
  }

  /**
   * Generic completion endpoint with adaptive timeout and graceful fallbacks
   */
  async complete(
    prompt: string,
    model: string = this.config.defaultModel,
    temperature: number = 0.7,
    operationType: string = 'section'
  ): Promise<string> {
    // Get adaptive timeout based on historical performance
    const adaptiveTimeout = this.performanceTracker.getRecommendedTimeout(model, operationType)

    console.log(`[Ollama] Adaptive timeout: ${(adaptiveTimeout / 1000).toFixed(1)}s (based on history)`)

    // Primary operation with adaptive timeout
    const primaryOperation = async (): Promise<string> => {
      return this.completeWithTimeout(prompt, model, temperature, adaptiveTimeout, operationType)
    }

    // Execute with fallback strategies
    const result: FallbackResult<string> = await this.fallbackService.executeWithFallback(
      `${model} ${operationType}`,
      primaryOperation,
      {
        maxRetries: 3,
        strategies: ['retry', 'reduce_length', 'minimal'],
        emergencyMode: this.recentFailures >= 3
      }
    )

    // Log fallback usage
    this.fallbackService.logFallbackUsage(result, `${model} ${operationType}`)

    if (!result.success) {
      // All strategies failed - use emergency content generation
      console.error(`🆘 EMERGENCY: All strategies failed, generating minimal fallback content`)
      this.recentFailures++

      // Generate emergency content based on operation type
      return this.generateEmergencyContent(operationType, prompt)
    }

    // Success - reset failure counter
    if (result.strategyUsed === 'primary') {
      this.recentFailures = 0
    }

    return result.data!
  }

  /**
   * Core completion with timeout tracking
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

      console.log(`[Ollama] Starting generation with model ${model}, temp ${temperature}`)

      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          temperature,
          options: {
            num_predict: 512,  // Reduced for faster response
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (!response.ok) {
        // Record failure
        this.performanceTracker.recordOperation(model, operationType, duration, false)
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as any
      const result = data.response || ''

      // Record successful operation
      this.performanceTracker.recordOperation(
        model,
        operationType,
        duration,
        true,
        result.length
      )

      console.log(`[Ollama] ✅ Generation completed in ${(duration / 1000).toFixed(2)}s`)

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      // Record failed operation
      this.performanceTracker.recordOperation(model, operationType, duration, false)

      console.error(`[Ollama] ❌ Error after ${(duration / 1000).toFixed(2)}s:`, error)
      throw error
    }
  }

  /**
   * Generate emergency fallback content when all else fails
   */
  private generateEmergencyContent(operationType: string, prompt: string): string {
    // Extract topic from prompt (simplified)
    const topicMatch = prompt.match(/(?:CHAPTER|TOPIC|TITLE):\s*"?([^"\n]+)"?/i)
    const topic = topicMatch ? topicMatch[1] : 'the subject matter'

    return this.fallbackService.generateEmergencyContent(operationType, topic)
  }

  /**
   * Get performance report for current model
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

  /**
   * Streaming completion for real-time text generation
   */
  async completeStream(
    prompt: string,
    onChunk: (text: string) => void,
    model: string = this.config.defaultModel,
    temperature: number = 0.7
  ): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
          temperature
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
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.response) {
              onChunk(data.response)
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (error) {
      console.error('Error in streaming completion:', error)
      throw error
    }
  }

  /**
   * Set the default model to use
   */
  setDefaultModel(model: string): void {
    this.config.defaultModel = model
  }

  // ===== Private Helper Methods =====

  private getPromptTemplate(
    templateName: string,
    params: Record<string, any>
  ): string {
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

      outline: (p) => {
        const cdText = p.creativeDirection ? `
CREATIVE DIRECTION:
- Voice: ${p.creativeDirection.voice}
- Uniqueness: ${p.creativeDirection.uniquenessAngle.type} - ${p.creativeDirection.uniquenessAngle.description}
- Reader Journey: ${p.creativeDirection.readerTransformation.before} → ${p.creativeDirection.readerTransformation.after}
- Emotional Arc: ${p.creativeDirection.emotionalJourney.openingEmotion} → ${p.creativeDirection.emotionalJourney.peakEmotion} → ${p.creativeDirection.emotionalJourney.closingEmotion}
- Genius Moments per Chapter: ${p.creativeDirection.geniusMomentsPerChapter}
- Competitive Edge: ${p.creativeDirection.competitiveDifferentiator}
` : ''

        return `You are a masterful book architect creating an outline that builds momentum and delivers memorable insights.

Book Title: "${p.title}"
Description: ${p.description}
Target Chapter Count: ${p.targetChapters}
${cdText}

Create an outline that:
1. Builds emotional momentum (${p.creativeDirection?.emotionalJourney ?
  `${p.creativeDirection.emotionalJourney.openingEmotion} → ${p.creativeDirection.emotionalJourney.peakEmotion} → ${p.creativeDirection.emotionalJourney.closingEmotion}`
  : 'curiosity → engagement → transformation'})
2. Places "genius moments" strategically (contrarian insights, unexpected connections, memorable stories)
3. Creates curiosity loops (raise questions, build tension, deliver payoffs)
4. Maintains ${p.creativeDirection?.voice || 'conversational'} voice throughout
5. Delivers on the uniqueness angle: ${p.creativeDirection?.uniquenessAngle?.description || 'fresh perspective'}

For EACH chapter, specify:
- Title: Intriguing, specific, sets expectations
- Description: 2-3 sentences on what the chapter delivers
- Genius Moment Type: What kind of memorable moment should occur (insight, contrarian, synthesis, metaphor, story)
- Emotional Arc: Where in the emotional journey this chapter sits (curiosity, building, peak, resolution, twist)
- 2-3 subsections

Format as JSON (IMPORTANT - must be valid JSON):
{
  "chapters": [
    {
      "id": "ch-1",
      "type": "chapter",
      "title": "Chapter 1: Compelling Title",
      "description": "What this chapter delivers",
      "geniusMomentType": "insight" | "contrarian" | "synthesis" | "metaphor" | "story",
      "emotionalArc": "curiosity" | "building" | "peak" | "resolution" | "twist",
      "children": [
        {
          "id": "ch-1-sec-1",
          "type": "section",
          "title": "Section Title",
          "description": "Section description"
        }
      ]
    }
  ]
}

Only output the JSON, no additional text.`
      },

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
      },

      geniusMoments: (p) => `You are a creative consultant specializing in memorable content.

CHAPTER: "${p.chapterTitle}"
CURRENT CONTENT:
${p.chapterContent.substring(0, 2000)}... [truncated for analysis]

VOICE: ${p.voice}

Suggest ${p.desiredCount} "genius moments" - insights/ideas/stories that will stick with readers.

For each moment:
1. Type: insight, contrarian, synthesis, metaphor, or story
2. Suggestion: The specific idea/angle/story
3. Placement: Where in the chapter it should go (opening, middle, climax, resolution)
4. Rationale: Why this will be memorable

Format as JSON array:
[
  {
    "type": "contrarian",
    "suggestion": "The specific insight here",
    "placement": "middle",
    "rationale": "Why readers will remember this"
  }
]

Only output the JSON array.`,

      contentAnalysis: (p) => `Analyze this content for quality and engagement potential.

CONTENT:
${p.content}

Provide:
1. Readability Score (1-10, where 10 is perfect clarity)
2. Emotional Tone: What emotions does this evoke? (list 3-5)
3. Uniqueness Indicators: What's fresh vs. generic? (list specific elements)
4. Curiosity Gaps: What unanswered questions does this create?
5. Genius Moment Candidates: Identify 2-3 sections that could become memorable with enhancement
6. Improvement Suggestions: 3-5 specific ways to elevate this content

Format as JSON:
{
  "readabilityScore": 8,
  "emotionalTone": ["curious", "engaged"],
  "uniquenessIndicators": ["specific novel element"],
  "curiosityGaps": ["unanswered question"],
  "geniusMomentCandidates": [
    {"position": 150, "type": "potential contrarian", "text": "excerpt"}
  ],
  "improvementSuggestions": ["specific suggestion"]
}

Only output JSON.`,

      refinePrompt: (p) => {
        let refinementInstructions = ''
        if (p.refinement.tone) {
          refinementInstructions += `\nTONE ADJUSTMENT: Make this ${p.refinement.tone.replace(/-/g, ' ')}`
        }
        if (p.refinement.focus) {
          refinementInstructions += `\nFOCUS ADJUSTMENT: ${p.refinement.focus.replace(/-/g, ' ')}`
        }
        if (p.refinement.geniusMomentType) {
          refinementInstructions += `\nADD GENIUS MOMENT: Include a ${p.refinement.geniusMomentType} insight`
        }

        return `Refine this writing prompt based on the requested adjustments.

ORIGINAL PROMPT:
${p.originalPrompt}

REFINEMENT REQUESTED:${refinementInstructions}

Output the REFINED PROMPT (not the original, not analysis, just the improved prompt).`
      },

      counterArgument: (p) => {
        const personas = {
          skeptic: 'You are a thoughtful skeptic who questions assumptions and asks for evidence.',
          advocate: 'You are a passionate advocate who builds on ideas and explores implications.',
          socratic: 'You are a Socratic questioner who asks deeper questions to reveal underlying assumptions.'
        }

        return `${personas[p.persona as keyof typeof personas]}

ORIGINAL QUESTION:
${p.question}

AUTHOR'S ANSWER:
${p.authorAnswer}

Provide a ${p.persona} response that:
- ${p.persona === 'skeptic' ? 'Challenges assumptions and asks for evidence' : ''}
- ${p.persona === 'advocate' ? 'Builds on the idea and explores implications' : ''}
- ${p.persona === 'socratic' ? 'Asks deeper questions to reveal underlying logic' : ''}
- Is respectful and intellectually curious
- Advances the conversation rather than just disagreeing
- Is 2-3 paragraphs maximum

Output your ${p.persona} response (no preamble, just the response).`
      },

      synthesizeDebate: (p) => {
        const positionsText = p.positions.map((pos: string, i: number) =>
          `Position ${i + 1}:\n${pos}\n`
        ).join('\n')

        return `Synthesize this debate into actionable insights.

ORIGINAL QUESTION:
${p.question}

POSITIONS DISCUSSED:
${positionsText}

Analyze and provide:
1. Convergence Points: Where do the positions agree?
2. Productive Tensions: Where do they disagree in useful ways?
3. New Insights: What new ideas emerged from the debate?
4. Chapter Ideas: What book chapters could this debate inspire?

Format as JSON:
{
  "convergencePoints": ["agreement 1", "agreement 2"],
  "productiveTensions": ["tension 1", "tension 2"],
  "newInsights": ["insight 1", "insight 2"],
  "chapterIdeas": ["chapter idea 1", "chapter idea 2"]
}

Only output JSON.`
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

      // Match numbered lines like "1. Chapter Title" or "1) Chapter Title"
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

      // Fallback: if parsing failed, generate generic chapters
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
      // Return fallback chapters
      const fallbackChapters = []
      for (let i = 0; i < expectedCount; i++) {
        fallbackChapters.push(`Chapter ${i + 1}`)
      }
      return fallbackChapters
    }
  }

  private parseOutline(jsonString: string): OutlineNode[] {
    try {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('No JSON found in outline response')
        return []
      }
      const data = JSON.parse(jsonMatch[0]) as { chapters: OutlineNode[] }
      return data.chapters || []
    } catch (error) {
      console.error('Error parsing outline:', error)
      return []
    }
  }

  private parseGeniusMoments(jsonString: string): GeniusMoment[] {
    try {
      const jsonMatch = jsonString.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []
      return JSON.parse(jsonMatch[0]) as GeniusMoment[]
    } catch (error) {
      console.error('Error parsing genius moments:', error)
      return []
    }
  }

  private parseContentAnalysis(jsonString: string): ContentAnalysis {
    try {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      return JSON.parse(jsonMatch[0]) as ContentAnalysis
    } catch (error) {
      console.error('Error parsing content analysis:', error)
      return {
        readabilityScore: 5,
        emotionalTone: [],
        uniquenessIndicators: [],
        curiosityGaps: [],
        geniusMomentCandidates: [],
        improvementSuggestions: []
      }
    }
  }

  private parseDebateSynthesis(jsonString: string): {
    convergencePoints: string[]
    productiveTensions: string[]
    newInsights: string[]
    chapterIdeas: string[]
  } {
    try {
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      return JSON.parse(jsonMatch[0])
    } catch (error) {
      console.error('Error parsing debate synthesis:', error)
      return {
        convergencePoints: [],
        productiveTensions: [],
        newInsights: [],
        chapterIdeas: []
      }
    }
  }
}
