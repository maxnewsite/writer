/**
 * Book Context & Tiered Memory System
 * Maintains global coherence and context across all chapters
 */

export interface BookContext {
  // Core book identity
  bookId: number
  thesis: string
  coreArgument: string
  targetAudience: string
  bookArchetype: 'how-to' | 'narrative' | 'reference' | 'memoir' | 'educational'
  toneMarkers: string[]

  // Tracking across chapters
  keyDecisions: Array<{
    chapterId: number
    chapterNumber: number
    decision: string
    rationale: string
  }>

  conceptIntroductions: Array<{
    concept: string
    introducedInChapter: number
    definition: string
  }>

  promisesToReaders: Array<{
    promise: string
    madeInChapter: number
    fulfilledInChapter: number | null
    status: 'pending' | 'fulfilled' | 'abandoned'
  }>

  characterOrEntityList: Array<{
    name: string
    role: string
    introducedInChapter: number
  }>

  // Style consistency
  styleGuide: {
    voiceDescription: string
    sentenceStyleExamples: string[]
    vocabularyLevel: 'simple' | 'intermediate' | 'advanced' | 'technical'
    formalityLevel: 'casual' | 'conversational' | 'formal' | 'academic'
  }
}

export interface TieredMemory {
  // Hot: Full text of last 2 chapters (always in prompt)
  hotMemory: Array<{
    chapterNumber: number
    chapterTitle: string
    fullContent: string
  }>

  // Warm: Summaries of all chapters (always in prompt)
  warmMemory: Array<{
    chapterNumber: number
    chapterTitle: string
    summary: string // ~50 words
    keyPoints: string[]
  }>

  // Cold: Full chapters stored but not in prompt (retrieved on-demand)
  coldMemory: Map<number, string> // chapterNumber -> fullContent

  // Permanent: Always in every prompt
  permanentContext: {
    thesis: string
    targetAudience: string
    conceptList: string[]
    styleGuide: string
  }
}

export interface QualityGateResult {
  passed: boolean
  gate: string
  score: number
  maxScore: number
  feedback: string
}

export interface QualityAssessment {
  overallPassed: boolean
  gates: QualityGateResult[]
  revisionSuggestions: string[]
  blockingIssues: string[]
}

export interface WritingPass {
  name: string
  purpose: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  output?: string
  feedback?: string
}

export interface MultiPassState {
  chapterId: number
  chapterNumber: number
  chapterTitle: string
  passes: WritingPass[]
  currentPass: number
  finalContent: string | null
  qualityAssessment: QualityAssessment | null
}

// Storage key prefix
const CONTEXT_KEY_PREFIX = 'book-context-'
const MEMORY_KEY_PREFIX = 'book-memory-'

/**
 * BookContextManager - Manages global book context and tiered memory
 */
export class BookContextManager {
  private bookId: number
  private context: BookContext
  private memory: TieredMemory

  constructor(bookId: number) {
    this.bookId = bookId
    this.context = this.loadContext()
    this.memory = this.loadMemory()
  }

  // Initialize context for a new book
  initializeContext(params: {
    thesis: string
    coreArgument: string
    targetAudience: string
    bookArchetype: BookContext['bookArchetype']
    toneMarkers: string[]
  }): void {
    this.context = {
      bookId: this.bookId,
      thesis: params.thesis,
      coreArgument: params.coreArgument,
      targetAudience: params.targetAudience,
      bookArchetype: params.bookArchetype,
      toneMarkers: params.toneMarkers,
      keyDecisions: [],
      conceptIntroductions: [],
      promisesToReaders: [],
      characterOrEntityList: [],
      styleGuide: {
        voiceDescription: '',
        sentenceStyleExamples: [],
        vocabularyLevel: 'intermediate',
        formalityLevel: 'conversational'
      }
    }
    this.saveContext()
  }

  // Update thesis/core argument
  updateThesis(thesis: string, coreArgument: string): void {
    this.context.thesis = thesis
    this.context.coreArgument = coreArgument
    this.saveContext()
  }

  // Record a key decision made in a chapter
  addKeyDecision(chapterId: number, chapterNumber: number, decision: string, rationale: string): void {
    this.context.keyDecisions.push({ chapterId, chapterNumber, decision, rationale })
    this.saveContext()
  }

  // Record a new concept introduction
  addConceptIntroduction(concept: string, chapterNumber: number, definition: string): void {
    // Check if concept already exists
    const existing = this.context.conceptIntroductions.find(c =>
      c.concept.toLowerCase() === concept.toLowerCase()
    )
    if (!existing) {
      this.context.conceptIntroductions.push({ concept, introducedInChapter: chapterNumber, definition })
      this.saveContext()
    }
  }

  // Record a promise to readers
  addPromise(promise: string, chapterNumber: number): void {
    this.context.promisesToReaders.push({
      promise,
      madeInChapter: chapterNumber,
      fulfilledInChapter: null,
      status: 'pending'
    })
    this.saveContext()
  }

  // Mark a promise as fulfilled
  fulfillPromise(promiseIndex: number, chapterNumber: number): void {
    if (this.context.promisesToReaders[promiseIndex]) {
      this.context.promisesToReaders[promiseIndex].fulfilledInChapter = chapterNumber
      this.context.promisesToReaders[promiseIndex].status = 'fulfilled'
      this.saveContext()
    }
  }

  // Add character or entity
  addCharacterOrEntity(name: string, role: string, chapterNumber: number): void {
    const existing = this.context.characterOrEntityList.find(c =>
      c.name.toLowerCase() === name.toLowerCase()
    )
    if (!existing) {
      this.context.characterOrEntityList.push({ name, role, introducedInChapter: chapterNumber })
      this.saveContext()
    }
  }

  // Update style guide based on first chapter
  updateStyleGuide(styleGuide: BookContext['styleGuide']): void {
    this.context.styleGuide = styleGuide
    this.saveContext()
  }

  // Get the full context
  getContext(): BookContext {
    return this.context
  }

  // === TIERED MEMORY MANAGEMENT ===

  // Add chapter to memory (call after chapter is written)
  addChapterToMemory(chapterNumber: number, chapterTitle: string, fullContent: string, summary: string, keyPoints: string[]): void {
    // Add to cold storage
    this.memory.coldMemory.set(chapterNumber, fullContent)

    // Add to warm memory
    this.memory.warmMemory.push({
      chapterNumber,
      chapterTitle,
      summary,
      keyPoints
    })

    // Update hot memory (keep only last 2)
    this.memory.hotMemory.push({
      chapterNumber,
      chapterTitle,
      fullContent
    })
    while (this.memory.hotMemory.length > 2) {
      this.memory.hotMemory.shift()
    }

    // Update permanent context
    this.memory.permanentContext = {
      thesis: this.context.thesis,
      targetAudience: this.context.targetAudience,
      conceptList: this.context.conceptIntroductions.map(c => c.concept),
      styleGuide: this.context.styleGuide.voiceDescription
    }

    this.saveMemory()
  }

  // Get context for writing prompt
  getWritingContext(): string {
    let context = ''

    // Permanent context (always included)
    context += `=== BOOK CONTEXT ===\n`
    context += `Thesis: ${this.context.thesis}\n`
    context += `Core Argument: ${this.context.coreArgument}\n`
    context += `Target Audience: ${this.context.targetAudience}\n`
    context += `Book Type: ${this.context.bookArchetype}\n`
    context += `Tone: ${this.context.toneMarkers.join(', ')}\n\n`

    // Style guide
    if (this.context.styleGuide.voiceDescription) {
      context += `=== STYLE GUIDE ===\n`
      context += `Voice: ${this.context.styleGuide.voiceDescription}\n`
      context += `Vocabulary: ${this.context.styleGuide.vocabularyLevel}\n`
      context += `Formality: ${this.context.styleGuide.formalityLevel}\n`
      if (this.context.styleGuide.sentenceStyleExamples.length > 0) {
        context += `Style Examples:\n${this.context.styleGuide.sentenceStyleExamples.map(s => `  - "${s}"`).join('\n')}\n`
      }
      context += '\n'
    }

    // Concepts introduced
    if (this.context.conceptIntroductions.length > 0) {
      context += `=== CONCEPTS INTRODUCED ===\n`
      this.context.conceptIntroductions.forEach(c => {
        context += `- ${c.concept} (Ch.${c.introducedInChapter}): ${c.definition}\n`
      })
      context += '\n'
    }

    // Key decisions
    if (this.context.keyDecisions.length > 0) {
      context += `=== KEY DECISIONS MADE ===\n`
      this.context.keyDecisions.slice(-5).forEach(d => {
        context += `- Ch.${d.chapterNumber}: ${d.decision}\n`
      })
      context += '\n'
    }

    // Unfulfilled promises
    const pendingPromises = this.context.promisesToReaders.filter(p => p.status === 'pending')
    if (pendingPromises.length > 0) {
      context += `=== PROMISES TO FULFILL ===\n`
      pendingPromises.forEach(p => {
        context += `- From Ch.${p.madeInChapter}: ${p.promise}\n`
      })
      context += '\n'
    }

    // Warm memory: Chapter summaries
    if (this.memory.warmMemory.length > 0) {
      context += `=== PREVIOUS CHAPTERS SUMMARY ===\n`
      this.memory.warmMemory.forEach(ch => {
        context += `Chapter ${ch.chapterNumber} - "${ch.chapterTitle}":\n`
        context += `  Summary: ${ch.summary}\n`
        context += `  Key Points: ${ch.keyPoints.join('; ')}\n\n`
      })
    }

    // Hot memory: Last 2 chapters full text (truncated if needed)
    if (this.memory.hotMemory.length > 0) {
      context += `=== RECENT CHAPTERS (Full Text) ===\n`
      this.memory.hotMemory.forEach(ch => {
        const truncated = ch.fullContent.length > 2000
          ? ch.fullContent.substring(0, 2000) + '...[truncated]'
          : ch.fullContent
        context += `\n--- Chapter ${ch.chapterNumber}: ${ch.chapterTitle} ---\n`
        context += truncated + '\n'
      })
    }

    return context
  }

  // Get cold storage content (on-demand retrieval)
  getChapterContent(chapterNumber: number): string | undefined {
    return this.memory.coldMemory.get(chapterNumber)
  }

  // Get all chapter summaries
  getAllSummaries(): TieredMemory['warmMemory'] {
    return this.memory.warmMemory
  }

  // Clear memory for a fresh start
  clearMemory(): void {
    this.memory = {
      hotMemory: [],
      warmMemory: [],
      coldMemory: new Map(),
      permanentContext: {
        thesis: '',
        targetAudience: '',
        conceptList: [],
        styleGuide: ''
      }
    }
    this.saveMemory()
  }

  // === PERSISTENCE ===

  private loadContext(): BookContext {
    try {
      const saved = localStorage.getItem(`${CONTEXT_KEY_PREFIX}${this.bookId}`)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load book context:', e)
    }

    // Return default context
    return {
      bookId: this.bookId,
      thesis: '',
      coreArgument: '',
      targetAudience: '',
      bookArchetype: 'educational',
      toneMarkers: [],
      keyDecisions: [],
      conceptIntroductions: [],
      promisesToReaders: [],
      characterOrEntityList: [],
      styleGuide: {
        voiceDescription: '',
        sentenceStyleExamples: [],
        vocabularyLevel: 'intermediate',
        formalityLevel: 'conversational'
      }
    }
  }

  private saveContext(): void {
    try {
      localStorage.setItem(`${CONTEXT_KEY_PREFIX}${this.bookId}`, JSON.stringify(this.context))
    } catch (e) {
      console.error('Failed to save book context:', e)
    }
  }

  private loadMemory(): TieredMemory {
    try {
      const saved = localStorage.getItem(`${MEMORY_KEY_PREFIX}${this.bookId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Restore Map from array
        parsed.coldMemory = new Map(parsed.coldMemory || [])
        return parsed
      }
    } catch (e) {
      console.error('Failed to load book memory:', e)
    }

    return {
      hotMemory: [],
      warmMemory: [],
      coldMemory: new Map(),
      permanentContext: {
        thesis: '',
        targetAudience: '',
        conceptList: [],
        styleGuide: ''
      }
    }
  }

  private saveMemory(): void {
    try {
      // Convert Map to array for JSON serialization
      const toSave = {
        ...this.memory,
        coldMemory: Array.from(this.memory.coldMemory.entries())
      }
      localStorage.setItem(`${MEMORY_KEY_PREFIX}${this.bookId}`, JSON.stringify(toSave))
    } catch (e) {
      console.error('Failed to save book memory:', e)
    }
  }
}

// Factory function
export function createBookContextManager(bookId: number): BookContextManager {
  return new BookContextManager(bookId)
}
