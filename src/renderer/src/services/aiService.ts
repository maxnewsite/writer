/**
 * Direct AI API Service for Browser
 * Calls Ollama and LM Studio APIs directly (no Electron IPC needed)
 * Enhanced with Multi-Pass Writing, Quality Gates, Topic-Calibrated Personas, and Real-Time Research
 */

import { researchService, type ChapterResearch } from './researchService'
import { db } from './database'

export type AIProviderType = 'ollama' | 'lmstudio'

export interface AIServiceConfig {
  providerType: AIProviderType
  ollamaUrl: string
  ollamaModel: string
  lmstudioUrl: string
  lmstudioModel: string
}

export interface BookIdea {
  title: string
  hook: string
  audience: string
  themes: string[]
  uniquenessAngle?: string
  emotionalTone?: string
}

// Calibrated Persona for specific topics
export interface CalibratedPersona {
  name: string
  description: string
  focusArea: string
  questionStyle: string
}

// Multi-Pass Writing Types
export interface WritingPassResult {
  passName: string
  content: string
  feedback?: string
  timestamp: number
}

export interface QualityGateResult {
  gateName: string
  passed: boolean
  score: number
  maxScore: number
  feedback: string
}

export interface QualityAssessment {
  overallPassed: boolean
  totalScore: number
  maxPossibleScore: number
  gates: QualityGateResult[]
  blockingIssues: string[]
  revisionSuggestions: string[]
}

export interface MultiPassWritingResult {
  finalContent: string
  passes: WritingPassResult[]
  qualityAssessment: QualityAssessment
  summary: string
  keyPoints: string[]
  conceptsIntroduced: string[]
  decisionsStatements: string[]
  research?: ChapterResearch // Real-time research data used
}

const DEFAULT_CONFIG: AIServiceConfig = {
  providerType: 'ollama',
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.1:8b',
  lmstudioUrl: 'http://127.0.0.1:1234',
  lmstudioModel: ''
}

// Clean writing style instructions (used across prompts)
const CLEAN_WRITING_STYLE = `
WRITING STYLE REQUIREMENTS:
- Write in clean, flowing prose paragraphs
- NO bullet points, numbered lists, or dashes for content
- NO asterisks except for **bold** on key terms (2-4 per section maximum)
- NO underscores, horizontal rules, or decorative separators
- Use ## for section headings only (2-4 per chapter)
- Paragraphs should be 3-5 sentences, flowing naturally
- Bold only the most important concepts, terms, or takeaways
- Transitions between paragraphs should be smooth and natural
- Write as if for a professionally published book
`

const CLEAN_WRITING_STYLE_COMPACT = `Clean prose, no bullets, bold key terms (max 4), ## for headings, 3-5 sentence paragraphs, professional tone.`

class AIService {
  private config: AIServiceConfig
  private cachedPersonas: Map<string, CalibratedPersona[]> = new Map()
  private compactMode: boolean = false // Enable for models with <8K context

  constructor() {
    const saved = localStorage.getItem('ai-config')
    this.config = saved ? JSON.parse(saved) : { ...DEFAULT_CONFIG }
    // Auto-enable compact mode for small context models
    const compactSetting = localStorage.getItem('ai-compact-mode')
    this.compactMode = compactSetting === 'true'
  }

  setCompactMode(enabled: boolean) {
    this.compactMode = enabled
    localStorage.setItem('ai-compact-mode', String(enabled))
    console.log(`🗜️ Compact mode ${enabled ? 'ENABLED' : 'DISABLED'} - optimized for ${enabled ? '<8K' : '8K+'} context models`)
  }

  private compressResearchContext(fullContext: string): string {
    if (!this.compactMode) return fullContext

    // Extract just the key statistics (most important part)
    const lines = fullContext.split('\n')
    const statsSection = []
    let inStats = false

    for (const line of lines) {
      if (line.includes('KEY STATISTICS')) {
        inStats = true
        continue
      }
      if (line.includes('CURRENT TRENDS') || line.includes('NOTABLE INSIGHTS')) {
        break
      }
      if (inStats && line.trim().startsWith('•')) {
        statsSection.push(line)
      }
    }

    if (statsSection.length > 0) {
      return `RESEARCH DATA (top ${Math.min(3, statsSection.length)} stats):\n${statsSection.slice(0, 3).join('\n')}\n`
    }

    return ''
  }

  private saveConfig() {
    localStorage.setItem('ai-config', JSON.stringify(this.config))
  }

  private getActiveUrl(): string {
    return this.config.providerType === 'ollama' ? this.config.ollamaUrl : this.config.lmstudioUrl
  }

  private getActiveModel(): string {
    return this.config.providerType === 'ollama' ? this.config.ollamaModel : this.config.lmstudioModel
  }

  async checkConnection(): Promise<boolean> {
    try {
      const url = this.getActiveUrl()
      const endpoint = this.config.providerType === 'ollama' ? '/api/tags' : '/v1/models'
      const response = await fetch(`${url}${endpoint}`, { signal: AbortSignal.timeout(5000) })
      return response.ok
    } catch {
      return false
    }
  }

  async checkAllConnections(): Promise<{ ollama: boolean; lmstudio: boolean }> {
    const results = { ollama: false, lmstudio: false }

    try {
      const ollamaResponse = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      })
      results.ollama = ollamaResponse.ok
    } catch {
      results.ollama = false
    }

    try {
      const lmstudioResponse = await fetch(`${this.config.lmstudioUrl}/v1/models`, {
        signal: AbortSignal.timeout(5000)
      })
      results.lmstudio = lmstudioResponse.ok
    } catch {
      results.lmstudio = false
    }

    return results
  }

  async listModels(): Promise<string[]> {
    try {
      const url = this.getActiveUrl()

      if (this.config.providerType === 'ollama') {
        const response = await fetch(`${url}/api/tags`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as any
        return data.models?.map((m: any) => m.name) || []
      } else {
        const response = await fetch(`${url}/v1/models`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as any
        return data.data?.map((m: any) => m.id) || []
      }
    } catch (error) {
      console.error('Failed to list models:', error)
      return []
    }
  }

  // ============================================================
  // CALIBRATED PERSONAS - Topic-specific reader perspectives
  // ============================================================

  /**
   * Generate 9 topic-calibrated personas for a specific book niche
   */
  async generateCalibratedPersonas(bookNiche: string, bookTitle: string): Promise<CalibratedPersona[]> {
    const cacheKey = `${bookNiche}-${bookTitle}`.toLowerCase()

    if (this.cachedPersonas.has(cacheKey)) {
      return this.cachedPersonas.get(cacheKey)!
    }

    console.log(`  🎭 Generating calibrated personas for "${bookNiche}"...`)

    const personaPrompt = `Create 9 distinct reader personas specifically for a book about "${bookNiche}" titled "${bookTitle}".

These personas should represent the ACTUAL types of readers who would buy this book, with perspectives unique to this topic.

For each persona, provide:
- A descriptive name (e.g., "The Overwhelmed Parent" for a parenting book, "The Career Changer" for a business book)
- Their background and why they're reading this book
- Their primary concern or focus area
- How they typically phrase questions

Format each persona exactly like this:
PERSONA 1:
NAME: [descriptive name]
BACKGROUND: [1-2 sentences about who they are]
FOCUS: [what they care most about]
STYLE: [how they ask questions - skeptical, practical, curious, etc.]

PERSONA 2:
[continue for all 9 personas]

Make personas diverse: include skeptics, beginners, experts, practitioners, and various demographic perspectives relevant to "${bookNiche}".`

    try {
      const response = await this.complete(personaPrompt, 0.8)
      const personas = this.parsePersonaResponse(response, bookNiche)

      if (personas.length >= 5) {
        this.cachedPersonas.set(cacheKey, personas)
        console.log(`    ✓ Generated ${personas.length} calibrated personas`)
        return personas
      }
    } catch (error) {
      console.error('Failed to generate calibrated personas:', error)
    }

    // Fallback to generic but topic-aware personas
    return this.getDefaultPersonas(bookNiche)
  }

  private parsePersonaResponse(response: string, niche: string): CalibratedPersona[] {
    const personas: CalibratedPersona[] = []
    const personaBlocks = response.split(/PERSONA \d+:/i).filter(b => b.trim())

    for (const block of personaBlocks) {
      const nameMatch = block.match(/NAME:\s*(.+?)(?:\n|$)/i)
      const backgroundMatch = block.match(/BACKGROUND:\s*(.+?)(?=FOCUS:|$)/is)
      const focusMatch = block.match(/FOCUS:\s*(.+?)(?=STYLE:|$)/is)
      const styleMatch = block.match(/STYLE:\s*(.+?)(?=PERSONA|\n\n|$)/is)

      if (nameMatch) {
        personas.push({
          name: nameMatch[1].trim(),
          description: backgroundMatch?.[1]?.trim() || `Reader interested in ${niche}`,
          focusArea: focusMatch?.[1]?.trim() || 'practical application',
          questionStyle: styleMatch?.[1]?.trim() || 'curious and engaged'
        })
      }
    }

    return personas.slice(0, 9)
  }

  private getDefaultPersonas(niche: string): CalibratedPersona[] {
    return [
      { name: 'The Skeptical Professional', description: `Experienced in ${niche}, questions new approaches`, focusArea: 'evidence and proof', questionStyle: 'challenges assumptions' },
      { name: 'The Eager Beginner', description: `New to ${niche}, wants clear foundations`, focusArea: 'fundamentals and clarity', questionStyle: 'asks for explanations' },
      { name: 'The Busy Practitioner', description: `Applies ${niche} daily, needs efficiency`, focusArea: 'practical application', questionStyle: 'wants actionable steps' },
      { name: 'The Deep Diver', description: `Seeks mastery in ${niche}`, focusArea: 'nuance and depth', questionStyle: 'probes for advanced insights' },
      { name: 'The Research-Minded', description: `Values evidence in ${niche}`, focusArea: 'sources and methodology', questionStyle: 'asks about research' },
      { name: 'The Story Seeker', description: `Learns through examples`, focusArea: 'real-world cases', questionStyle: 'requests examples and stories' },
      { name: 'The Contrarian Thinker', description: `Questions mainstream ${niche} wisdom`, focusArea: 'alternative perspectives', questionStyle: 'plays devil\'s advocate' },
      { name: 'The Time-Pressed Reader', description: `Limited time for ${niche} learning`, focusArea: 'key takeaways', questionStyle: 'wants summaries' },
      { name: 'The Connector', description: `Relates ${niche} to other fields`, focusArea: 'interdisciplinary links', questionStyle: 'asks how concepts relate' }
    ]
  }

  // Generate book ideas
  async generateBookIdeas(niche: string, count: number = 5): Promise<BookIdea[]> {
    const ideas: BookIdea[] = []

    for (let i = 0; i < Math.min(count, 3); i++) {
      const prompt = `Generate one creative book idea for the "${niche}" niche.

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
TONE: [Primary emotion: empowered/enlightened/entertained]`

      try {
        const result = await this.complete(prompt, 0.85)
        const idea = this.parseSingleBookIdea(result, niche)
        if (idea) ideas.push(idea)
      } catch (error) {
        console.error('Failed to generate idea:', error)
      }
    }

    return ideas
  }

  // Generate outline
  async generateOutline(title: string, description: string, targetChapters: number = 10): Promise<any[]> {
    const chapterCount = Math.min(targetChapters, 8)
    const prompt = `Create ${chapterCount} compelling chapter titles for a book.

Book Title: "${title}"
Description: ${description}

Requirements:
- Clear, engaging chapter titles
- Logical progression
- Build momentum throughout

Format: List each chapter title on a new line, numbered 1-${chapterCount}.
Example:
1. Chapter Title One
2. Chapter Title Two

Only output the numbered list, nothing else.`

    try {
      const result = await this.complete(prompt, 0.75)
      const chapterTitles = this.parseChapterList(result, chapterCount)

      return chapterTitles.map((title, i) => ({
        id: `ch-${i + 1}`,
        type: 'chapter',
        title,
        description: `Chapter ${i + 1} content`,
        children: []
      }))
    } catch (error) {
      console.error('Failed to generate outline:', error)
      throw error
    }
  }

  // Generate chapter prompt
  async generateChapterPrompt(chapterTitle: string, topQuestions: any[]): Promise<string> {
    const questionsText = topQuestions.map((q, i) => `${i + 1}. ${q.text} (${q.vote_count} votes)`).join('\n')

    const prompt = `You are a creative writing coach helping craft a memorable chapter.

CHAPTER: "${chapterTitle}"
TOP READER QUESTIONS (what they want to know):
${questionsText}

YOUR TASK: Create a writing prompt that will produce a chapter readers can't stop thinking about.

Provide specific, actionable guidance that will help the author write something MEMORABLE.`

    return this.complete(prompt, 0.8)
  }

  // Generate full chapter content with clean formatting
  async generateChapterContent(prompt: string): Promise<string> {
    const enhancedPrompt = `${prompt}

${CLEAN_WRITING_STYLE}`

    const url = this.getActiveUrl()
    const model = this.getActiveModel()

    if (this.config.providerType === 'ollama') {
      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: enhancedPrompt,
          stream: false,
          temperature: 0.7,
          options: {
            num_predict: 2048,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as any
      return this.cleanOutputFormatting(data.response || '')
    } else {
      const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'local-model',
          messages: [{ role: 'user', content: enhancedPrompt }],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as any
      return this.cleanOutputFormatting(data.choices?.[0]?.message?.content || '')
    }
  }

  /**
   * Clean up AI output to remove excessive formatting
   */
  private cleanOutputFormatting(content: string): string {
    let cleaned = content

    // Remove excessive bullet points and convert to prose
    cleaned = cleaned.replace(/^[\s]*[-•*]\s+/gm, '')

    // Remove numbered lists that aren't chapter numbers
    cleaned = cleaned.replace(/^\s*\d+\)\s+/gm, '')

    // Remove horizontal rules and decorative separators
    cleaned = cleaned.replace(/^[_\-=*]{3,}$/gm, '')
    cleaned = cleaned.replace(/^[\s]*[─━═]{3,}[\s]*$/gm, '')

    // Clean up triple asterisks used as separators
    cleaned = cleaned.replace(/\*\*\*+/g, '\n\n')

    // Remove underscores used for emphasis (keep bold)
    cleaned = cleaned.replace(/_{2,}/g, '')
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1')

    // Limit consecutive newlines to 2
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n')

    // Ensure section headings have proper spacing
    cleaned = cleaned.replace(/\n*(#{1,3}\s+[^\n]+)\n*/g, '\n\n$1\n\n')

    // Clean up any remaining markdown artifacts
    cleaned = cleaned.replace(/```[^`]*```/g, '')

    return cleaned.trim()
  }

  // Generate AI reader feedback with calibrated personas
  async generateReaderFeedback(
    chapterTitle: string,
    chapterContent: string,
    bookNiche?: string,
    bookTitle?: string
  ): Promise<Array<{ question: string; persona: string; votes: number }>> {
    console.log('  🎭 Generating feedback with calibrated personas...')

    // Get calibrated personas for this topic
    const personas = bookNiche && bookTitle
      ? await this.generateCalibratedPersonas(bookNiche, bookTitle)
      : this.getDefaultPersonas('general')

    // const personaList = personas
    //   .map((p, i) => `${i + 1}. **${p.name}** - ${p.description}. Focus: ${p.focusArea}. Style: ${p.questionStyle}`)
    //   .join('\n')

    // Try a direct, simple approach that's easier for the AI
    const personaPrompt = `You are generating reader questions. Below are ${personas.length} different reader personas who just read a chapter.

PERSONAS:
${personas.map((p, i) => `${i + 1}. ${p.name} - ${p.focusArea}`).join('\n')}

CHAPTER: "${chapterTitle}"
CONTENT PREVIEW:
${chapterContent.substring(0, 800)}...

TASK: Each of the ${personas.length} personas asks ONE thoughtful question about this chapter.

OUTPUT FORMAT - You must generate EXACTLY ${personas.length} numbered lines like this:
1. The Practitioner: How can I apply this in my daily work?
2. The Beginner: What's the simplest way to get started with this?
3. The Story Seeker: Can you share a real example of this in action?
...and so on for ALL ${personas.length} personas.

NOW GENERATE ALL ${personas.length} QUESTIONS (one per line, numbered 1-${personas.length}):`

    console.log(`    🤖 Requesting ${personas.length} questions from AI model...`)
    let personaResponse = await this.complete(personaPrompt, 0.7)
    console.log(`    📝 AI raw response (${personaResponse.length} chars):`)
    console.log(`    ${'-'.repeat(60)}`)
    console.log(personaResponse)
    console.log(`    ${'-'.repeat(60)}`)

    // Parse persona questions - be more forgiving with parsing
    let personaQuestions = personaResponse
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.match(/^\d+\./))
      .map((line, index) => {
        console.log(`    🔍 Parsing line ${index + 1}: "${line.substring(0, 80)}..."`)

        // Try to extract persona name and question
        const match = line.match(/^\d+\.\s*([^:?]+)[:\-]?\s*(.+)/)
        if (match) {
          const persona = match[1].trim()
          const question = match[2].trim()
          console.log(`      ✓ Found: Persona="${persona}", Question="${question.substring(0, 50)}..."`)
          return {
            persona: persona,
            question: question,
            votes: 0
          }
        }

        // Fallback: use the whole line as question, assign persona from list
        const questionPart = line.replace(/^\d+\.\s*/, '').trim()
        if (questionPart.length > 10) {
          const fallbackPersona = personas[index]?.name || `Reader ${index + 1}`
          console.log(`      ⚠️ Fallback parsing: Persona="${fallbackPersona}", Question="${questionPart.substring(0, 50)}..."`)
          return {
            persona: fallbackPersona,
            question: questionPart,
            votes: 0
          }
        }

        console.log(`      ✗ Failed to parse this line`)
        return null
      })
      .filter((q): q is { persona: string; question: string; votes: number } =>
        q !== null && q.question.length > 10
      )
      .slice(0, 9)

    console.log(`    📊 Successfully parsed ${personaQuestions.length} questions`)

    // If we got very few questions (less than 3), try one more time with an even simpler prompt
    if (personaQuestions.length < 3) {
      console.warn(`    🔄 CRITICAL: Only got ${personaQuestions.length} questions! Trying ultra-simple prompt...`)

      const ultraSimplePrompt = `List ${personas.length} reader questions about the chapter "${chapterTitle}".

Use this exact format:
1. Question text here
2. Question text here
3. Question text here
4. Question text here
5. Question text here
6. Question text here
7. Question text here
8. Question text here
9. Question text here

Generate all ${personas.length} lines now:`

      personaResponse = await this.complete(ultraSimplePrompt, 0.5)
      console.log(`    📝 Second attempt response (${personaResponse.length} chars):`)
      console.log(personaResponse)

      personaQuestions = personaResponse
        .split('\n')
        .filter(line => line.trim().match(/^\d+\./))
        .map((line, index) => {
          const questionPart = line.replace(/^\d+\.\s*/, '').trim()
          return {
            persona: personas[index]?.name || `Reader ${index + 1}`,
            question: questionPart,
            votes: 0
          }
        })
        .filter((q): q is { persona: string; question: string; votes: number } =>
          q !== null && q.question.length > 10
        )
        .slice(0, 9)

      console.log(`    📊 After ultra-simple retry: ${personaQuestions.length} questions`)
    }

    if (personaQuestions.length === 0) {
      return [
        { question: 'What are the key takeaways from this chapter?', persona: personas[0]?.name || 'The Practitioner', votes: 0 },
        { question: 'How does this apply to real-world situations?', persona: personas[1]?.name || 'The Beginner', votes: 0 },
        { question: 'What examples could make this clearer?', persona: personas[2]?.name || 'The Story Seeker', votes: 0 }
      ]
    }

    console.log(`  💬 Generated ${personaQuestions.length} questions from calibrated personas`)

    // If we got fewer than expected, warn but continue
    if (personaQuestions.length < personas.length) {
      console.warn(`    ⚠️ Expected ${personas.length} questions but got ${personaQuestions.length}`)
      console.log(`    📝 AI response preview: ${personaResponse.substring(0, 300)}...`)
    }

    // Voting phase (only if we have questions)
    if (personaQuestions.length === 0) {
      console.error('    ❌ No questions generated! Skipping voting.')
      return personaQuestions
    }

    console.log('  🗳️ Personas voting (2 votes each)...')
    console.log(`    📋 ${personaQuestions.length} questions to vote on`)
    console.log(`    📊 Expected total votes: ${personaQuestions.length * 2} (${personaQuestions.length} personas × 2 votes each)`)

    const votingPrompt = `These ${personaQuestions.length} personas asked questions:

${personaQuestions.map((q, i) => `${i + 1}. ${q.persona}: ${q.question}`).join('\n')}

Now each persona votes for their 2 MOST IMPORTANT questions (cannot vote for own).

OUTPUT FORMAT - Generate EXACTLY ${personaQuestions.length} lines like this:
1. The Practitioner votes: 2, 5
2. The Beginner votes: 1, 3
3. The Story Seeker votes: 2, 4
...and so on for ALL ${personaQuestions.length} personas.

Generate all ${personaQuestions.length} voting lines (format: "PersonaName votes: #, #"):`

    const voteResponse = await this.complete(votingPrompt, 0.6)
    console.log(`    📝 AI voting response (${voteResponse.length} chars):`)
    console.log(`    ${'-'.repeat(60)}`)
    console.log(voteResponse)
    console.log(`    ${'-'.repeat(60)}`)

    // Parse voting results with detailed logging
    const voteLines = voteResponse
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.includes('votes:') || line.includes('vote:')))

    console.log(`    📋 Found ${voteLines.length} lines containing "vote" keyword`)

    let totalVotesCast = 0
    for (let i = 0; i < voteLines.length; i++) {
      const line = voteLines[i]
      console.log(`    🔍 Processing vote line ${i + 1}: "${line}"`)

      // Try multiple patterns to extract votes
      let match = line.match(/votes?:\s*(\d+)\s*,\s*(\d+)/)  // "votes: 2, 5"
      if (!match) {
        match = line.match(/votes?:\s*(\d+)\s+and\s+(\d+)/)  // "votes: 2 and 5"
      }
      if (!match) {
        match = line.match(/votes?:\s*(\d+)\s+(\d+)/)  // "votes: 2 5"
      }
      if (!match) {
        // Try to find any two numbers in the line
        const numbers = line.match(/\d+/g)
        if (numbers && numbers.length >= 2) {
          console.log(`      ⚠️ Using fallback parsing - found numbers: ${numbers.join(', ')}`)
          match = ['', numbers[0], numbers[1]] as RegExpMatchArray
        }
      }

      if (match) {
        const vote1 = parseInt(match[1]) - 1
        const vote2 = parseInt(match[2]) - 1

        console.log(`      ✓ Extracted votes: ${match[1]} and ${match[2]} (0-indexed: ${vote1}, ${vote2})`)

        if (vote1 >= 0 && vote1 < personaQuestions.length) {
          personaQuestions[vote1].votes++
          totalVotesCast++
          console.log(`        → Question ${vote1 + 1} now has ${personaQuestions[vote1].votes} votes`)
        } else {
          console.log(`        ✗ Vote ${match[1]} out of range (valid: 1-${personaQuestions.length})`)
        }

        if (vote2 >= 0 && vote2 < personaQuestions.length) {
          personaQuestions[vote2].votes++
          totalVotesCast++
          console.log(`        → Question ${vote2 + 1} now has ${personaQuestions[vote2].votes} votes`)
        } else {
          console.log(`        ✗ Vote ${match[2]} out of range (valid: 1-${personaQuestions.length})`)
        }
      } else {
        console.log(`      ✗ Could not parse votes from this line`)
      }
    }

    console.log(`    ✅ Total votes cast: ${totalVotesCast} (expected: ~${personaQuestions.length * 2})`)

    const sortedQuestions = personaQuestions.sort((a, b) => b.votes - a.votes)

    console.log(`  ✅ Voting complete!`)
    sortedQuestions.slice(0, 3).forEach((q, i) => {
      console.log(`    ${i + 1}. [${q.persona}] ${q.votes} votes: "${q.question.substring(0, 50)}..."`)
    })

    return sortedQuestions
  }

  // Analyze feedback for improvement
  async analyzeFeedbackForImprovement(
    chapterTitle: string,
    questions: Array<{ question: string; persona: string; votes: number }>,
    nextChapterTitle: string
  ): Promise<string> {
    const questionsText = questions
      .slice(0, 3)
      .map((q, i) => `${i + 1}. [${q.persona}] (${q.votes} votes): ${q.question}`)
      .join('\n')

    const prompt = `You are analyzing reader feedback from a previous chapter to improve the next one.

Previous Chapter: "${chapterTitle}"
Top Reader Questions (voted by calibrated personas):
${questionsText}

Next Chapter: "${nextChapterTitle}"

Based on the reader feedback, provide 2-3 specific insights that should be incorporated into the next chapter. Write in clear prose, no bullets.`

    return this.complete(prompt, 0.7)
  }

  // ============================================================
  // MULTI-PASS WRITING SYSTEM WITH CLEAN OUTPUT
  // ============================================================

  async writeChapterMultiPass(
    chapterNumber: number,
    chapterTitle: string,
    chapterDescription: string,
    bookContext: string,
    topQuestionsFromPrevious: string[],
    onProgress?: (pass: string, status: string) => void,
    bookNiche?: string,
    bookTitle?: string,
    chapterId?: number,
    bookId?: number
  ): Promise<MultiPassWritingResult> {
    const passes: WritingPassResult[] = []
    let chapterResearch: ChapterResearch | null = null
    let researchContext = ''

    console.log(`\n🔄 Starting Multi-Pass Writing for Chapter ${chapterNumber}: ${chapterTitle}`)
    console.log(`  📊 Research params - Niche: "${bookNiche}", Title: "${bookTitle}", ChapterID: ${chapterId}, BookID: ${bookId}`)
    if (this.compactMode) {
      console.log(`  🗜️ COMPACT MODE ACTIVE - Prompts optimized for <8K context models`)
    }

    // === PHASE 0: REAL-TIME RESEARCH ===
    if (bookNiche && bookTitle) {
      onProgress?.('research', 'Gathering real-time research data...')
      console.log('  🔬 Phase 0: Conducting real-time research...')
    } else {
      console.log('  ⚠️ Skipping research phase - missing book niche or title')
      console.log(`     Niche provided: ${!!bookNiche}, Title provided: ${!!bookTitle}`)
    }

    if (bookNiche && bookTitle) {

      try {
        // Check for cached research in database first
        if (chapterId) {
          const cachedResearch = await db.getChapterResearch(chapterId)
          if (cachedResearch) {
            console.log('    📚 Using cached research from database')
            chapterResearch = {
              chapterId: cachedResearch.chapter_id,
              chapterTitle: cachedResearch.chapter_title,
              bookNiche: cachedResearch.book_niche,
              bookTitle: cachedResearch.book_title,
              research: JSON.parse(cachedResearch.raw_research || '[]'),
              summary: cachedResearch.summary,
              keyStatistics: JSON.parse(cachedResearch.key_statistics || '[]'),
              recentTrends: JSON.parse(cachedResearch.recent_trends || '[]'),
              notableQuotes: JSON.parse(cachedResearch.notable_quotes || '[]'),
              suggestedCitations: JSON.parse(cachedResearch.suggested_citations || '[]'),
              researchedAt: cachedResearch.researched_at
            }
          }
        }

        // Conduct fresh research if not cached
        if (!chapterResearch) {
          chapterResearch = await researchService.researchForChapter(
            chapterTitle,
            chapterDescription,
            bookNiche,
            bookTitle,
            (status) => onProgress?.('research', status)
          )

          // Save research to database
          if (chapterId && bookId && chapterResearch) {
            const expiresAt = new Date()
            expiresAt.setHours(expiresAt.getHours() + 24)

            await db.saveChapterResearch({
              chapter_id: chapterId,
              book_id: bookId,
              chapter_title: chapterTitle,
              book_niche: bookNiche,
              book_title: bookTitle,
              summary: chapterResearch.summary,
              key_statistics: JSON.stringify(chapterResearch.keyStatistics),
              recent_trends: JSON.stringify(chapterResearch.recentTrends),
              notable_quotes: JSON.stringify(chapterResearch.notableQuotes),
              suggested_citations: JSON.stringify(chapterResearch.suggestedCitations),
              raw_research: JSON.stringify(chapterResearch.research),
              researched_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString()
            })
            console.log('    💾 Research saved to database')
          }
        }

        // Format research for injection into prompts
        if (chapterResearch) {
          researchContext = researchService.formatForWritingPrompt(chapterResearch)
          passes.push({
            passName: 'research',
            content: researchContext,
            feedback: `Found ${chapterResearch.keyStatistics.length} statistics, ${chapterResearch.recentTrends.length} trends`,
            timestamp: Date.now()
          })
          console.log(`    ✓ Research complete: ${chapterResearch.keyStatistics.length} statistics, ${chapterResearch.recentTrends.length} trends`)
        }
      } catch (error) {
        console.error('    ⚠️ Research phase failed:', error)
        passes.push({
          passName: 'research',
          content: 'Research unavailable - proceeding with AI knowledge',
          feedback: 'Research failed, using training data only',
          timestamp: Date.now()
        })
      }
    }

    // === PASS 1: SKELETON ===
    onProgress?.('skeleton', 'Generating chapter structure...')
    console.log('  📋 Pass 1: Generating skeleton/structure...')

    const skeletonPrompt = `Create a detailed structure for this chapter. Do NOT write the full content yet.

${bookContext}

Chapter ${chapterNumber}: "${chapterTitle}"
${chapterDescription ? `Description: ${chapterDescription}` : ''}

${researchContext ? `
${researchContext}
` : ''}

${topQuestionsFromPrevious.length > 0 ? `
Reader Questions to Address:
${topQuestionsFromPrevious.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}

Create a skeleton with:
1. Opening approach (1 sentence)
2. Main sections (3-4 sections with what each covers)
3. Key statistics or data points to incorporate from the research
4. Key examples or stories to include
5. Closing approach

Write this as a brief outline. Be specific about what goes in each section. Plan where to integrate the research statistics and trends.`

    const skeleton = await this.complete(skeletonPrompt, 0.7)
    passes.push({
      passName: 'skeleton',
      content: skeleton,
      timestamp: Date.now()
    })
    console.log(`    ✓ Skeleton complete (${skeleton.length} chars)`)

    // === PASS 2: FIRST DRAFT ===
    onProgress?.('first_draft', 'Writing first draft...')
    console.log('  ✍️ Pass 2: Writing first draft...')

    // Compress research if in compact mode
    const finalResearchContext = researchContext ? this.compressResearchContext(researchContext) : ''

    const draftPrompt = this.compactMode ?
      // COMPACT VERSION (for <8K context models)
      `Write chapter based on structure.

${bookContext.length > 500 ? bookContext.substring(0, 500) + '...' : bookContext}

Chapter ${chapterNumber}: "${chapterTitle}"

STRUCTURE:
${skeleton.length > 400 ? skeleton.substring(0, 400) + '...' : skeleton}

${finalResearchContext}

${topQuestionsFromPrevious.length > 0 ? `
Address: ${topQuestionsFromPrevious.slice(0, 2).join('; ')}
` : ''}

Write 1000-1500 words. ${CLEAN_WRITING_STYLE_COMPACT} Bold **key stats**.`
      :
      // FULL VERSION (for 8K+ context models)
      `Write the complete chapter based on this structure.

${bookContext}

Chapter ${chapterNumber}: "${chapterTitle}"

STRUCTURE TO FOLLOW:
${skeleton}

${finalResearchContext ? `
${finalResearchContext}

IMPORTANT: Integrate the statistics and trends naturally into your writing. Use phrases like:
- "According to recent research..."
- "Studies show that..."
- "Current data indicates..."
- "A recent survey found..."
Bold the key statistics to make them stand out.
` : ''}

${topQuestionsFromPrevious.length > 0 ? `
MUST ADDRESS THESE READER QUESTIONS:
${topQuestionsFromPrevious.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}

Write the full chapter (1000-1500 words).

${CLEAN_WRITING_STYLE}

Use **bold** sparingly for key concepts, important terms, statistics, or crucial takeaways (maximum 3-4 bold phrases per section).`

    const firstDraft = await this.generateChapterContent(draftPrompt)
    passes.push({
      passName: 'first_draft',
      content: firstDraft,
      timestamp: Date.now()
    })
    console.log(`    ✓ First draft complete (${firstDraft.length} chars, ~${Math.round(firstDraft.split(/\s+/).length)} words)`)

    // === PASS 3: CALIBRATED PERSONA CRITIQUE ===
    onProgress?.('persona_critique', 'Getting calibrated persona feedback...')
    console.log('  🎭 Pass 3: Calibrated Persona Critique...')

    const personaFeedback = await this.generateReaderFeedback(
      chapterTitle,
      firstDraft,
      bookNiche,
      bookTitle
    )
    const topCritiques = personaFeedback.slice(0, 3)

    passes.push({
      passName: 'persona_critique',
      content: topCritiques.map(q => `[${q.persona}] (${q.votes} votes): ${q.question}`).join('\n'),
      feedback: `Top 3 issues identified by calibrated personas`,
      timestamp: Date.now()
    })
    console.log(`    ✓ Critique complete - ${personaFeedback.length} questions, top 3 selected`)

    // === PASS 4: TARGETED REVISION ===
    onProgress?.('revision', 'Revising based on feedback...')
    console.log('  🔧 Pass 4: Targeted Revision...')

    const revisionPrompt = `Revise this chapter to address the critical feedback from reader personas.

CURRENT CHAPTER:
${firstDraft}

CRITICAL FEEDBACK TO ADDRESS:
${topCritiques.map((q, i) => `${i + 1}. [${q.persona}] (${q.votes} votes): ${q.question}`).join('\n')}

Revise the chapter to:
1. Directly address each of the top 3 concerns
2. Add missing information or examples where needed
3. Clarify any confusing sections
4. Maintain the same overall structure and flow

${CLEAN_WRITING_STYLE}

Output the complete revised chapter.`

    const revisedDraft = await this.generateChapterContent(revisionPrompt)
    passes.push({
      passName: 'revision',
      content: revisedDraft,
      feedback: `Addressed ${topCritiques.length} persona critiques`,
      timestamp: Date.now()
    })
    console.log(`    ✓ Revision complete (${revisedDraft.length} chars)`)

    // === PASS 5: STYLE POLISH ===
    onProgress?.('polish', 'Polishing style and flow...')
    console.log('  ✨ Pass 5: Style Polish...')

    const polishPrompt = `Polish this chapter for professional publication quality.

CHAPTER TO POLISH:
${revisedDraft}

Focus on:
1. Smooth transitions between paragraphs
2. Varied sentence structure and rhythm
3. Removing redundant phrases and filler words
4. Strengthening the opening hook
5. Improving the closing and transition to next chapter
6. Ensuring consistent, engaging voice throughout
7. Strategic **bold** on key concepts only (2-4 per section maximum)

${CLEAN_WRITING_STYLE}

Output the complete polished chapter. Make refined improvements while preserving the content.`

    const polishedDraft = await this.generateChapterContent(polishPrompt)
    passes.push({
      passName: 'polish',
      content: polishedDraft,
      timestamp: Date.now()
    })
    console.log(`    ✓ Polish complete (${polishedDraft.length} chars)`)

    // === PASS 6: QUALITY GATES ===
    onProgress?.('quality_gates', 'Running quality assessment...')
    console.log('  🚦 Pass 6: Quality Gates Assessment...')

    const qualityAssessment = await this.runQualityGates(
      polishedDraft,
      chapterTitle,
      bookContext,
      topQuestionsFromPrevious
    )

    passes.push({
      passName: 'quality_gates',
      content: `Score: ${qualityAssessment.totalScore}/${qualityAssessment.maxPossibleScore}`,
      feedback: qualityAssessment.gates.map(g => `${g.gateName}: ${g.passed ? '✓' : '✗'} (${g.score}/${g.maxScore})`).join('\n'),
      timestamp: Date.now()
    })

    console.log(`    ✓ Quality assessment: ${qualityAssessment.overallPassed ? 'PASSED' : 'NEEDS REVISION'}`)
    console.log(`      Score: ${qualityAssessment.totalScore}/${qualityAssessment.maxPossibleScore}`)

    // === GENERATE METADATA ===
    onProgress?.('metadata', 'Extracting chapter metadata...')
    console.log('  📊 Extracting metadata...')

    const metadata = await this.extractChapterMetadata(polishedDraft, chapterTitle)

    console.log(`\n✅ Multi-Pass Writing Complete for Chapter ${chapterNumber}!`)
    if (chapterResearch) {
      console.log(`    📊 Research integrated: ${chapterResearch.keyStatistics.length} statistics, ${chapterResearch.recentTrends.length} trends`)
    }

    return {
      finalContent: polishedDraft,
      passes,
      qualityAssessment,
      summary: metadata.summary,
      keyPoints: metadata.keyPoints,
      conceptsIntroduced: metadata.conceptsIntroduced,
      decisionsStatements: metadata.decisionsStatements,
      research: chapterResearch || undefined
    }
  }

  // ============================================================
  // QUALITY GATES SYSTEM
  // ============================================================

  async runQualityGates(
    content: string,
    chapterTitle: string,
    bookContext: string,
    questionsToAddress: string[]
  ): Promise<QualityAssessment> {
    const gates: QualityGateResult[] = []
    const blockingIssues: string[] = []
    const revisionSuggestions: string[] = []

    // Gate 1: Length Check
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    const lengthGate: QualityGateResult = {
      gateName: 'Length Check',
      passed: wordCount >= 600 && wordCount <= 2000,
      score: wordCount >= 600 && wordCount <= 2000 ? 10 : (wordCount >= 400 ? 5 : 0),
      maxScore: 10,
      feedback: `Word count: ${wordCount} (target: 600-2000)`
    }
    gates.push(lengthGate)
    if (!lengthGate.passed) {
      if (wordCount < 600) {
        blockingIssues.push(`Chapter too short (${wordCount} words). Minimum 600 words required.`)
      } else {
        revisionSuggestions.push(`Chapter may be too long (${wordCount} words). Consider tightening.`)
      }
    }

    // Gate 2: Structure Check
    const hasHeadings = content.includes('##') || content.includes('# ')
    const structureGate: QualityGateResult = {
      gateName: 'Structure Check',
      passed: hasHeadings,
      score: hasHeadings ? 10 : 0,
      maxScore: 10,
      feedback: hasHeadings ? 'Has proper section headings' : 'Missing section headings'
    }
    gates.push(structureGate)
    if (!hasHeadings) {
      revisionSuggestions.push('Add section headings to improve structure and readability.')
    }

    // Gate 3: Clean Formatting Check
    const hasBullets = (content.match(/^[\s]*[-•*]\s+/gm) || []).length
    const hasExcessiveFormatting = hasBullets > 5
    const formattingGate: QualityGateResult = {
      gateName: 'Clean Formatting',
      passed: !hasExcessiveFormatting,
      score: hasExcessiveFormatting ? 5 : 10,
      maxScore: 10,
      feedback: hasExcessiveFormatting ? `Found ${hasBullets} bullet points (prefer prose)` : 'Clean prose formatting'
    }
    gates.push(formattingGate)

    // Gate 4: AI Quality Assessment
    const coherencePrompt = `Evaluate this chapter for quality. Score each dimension 1-10.

CHAPTER TITLE: "${chapterTitle}"

CONTENT:
${content.substring(0, 2000)}${content.length > 2000 ? '...[truncated]' : ''}

BOOK CONTEXT:
${bookContext.substring(0, 500)}

Score these dimensions (1-10 each):
1. COHERENCE: Does it flow logically?
2. RELEVANCE: Does it fit the book's purpose?
3. CLARITY: Is it easy to understand?
4. ENGAGEMENT: Is it interesting to read?
5. COMPLETENESS: Does it cover the topic adequately?

Format:
COHERENCE: [score]
RELEVANCE: [score]
CLARITY: [score]
ENGAGEMENT: [score]
COMPLETENESS: [score]
ISSUES: [any major issues, or "none"]`

    const coherenceResponse = await this.complete(coherencePrompt, 0.3)

    const parseScore = (text: string, dimension: string): number => {
      const match = text.match(new RegExp(`${dimension}:\\s*(\\d+)`, 'i'))
      return match ? Math.min(10, Math.max(1, parseInt(match[1]))) : 5
    }

    const coherenceScore = parseScore(coherenceResponse, 'COHERENCE')
    const relevanceScore = parseScore(coherenceResponse, 'RELEVANCE')
    const clarityScore = parseScore(coherenceResponse, 'CLARITY')
    const engagementScore = parseScore(coherenceResponse, 'ENGAGEMENT')
    const completenessScore = parseScore(coherenceResponse, 'COMPLETENESS')

    gates.push({
      gateName: 'Coherence',
      passed: coherenceScore >= 6,
      score: coherenceScore,
      maxScore: 10,
      feedback: `Logical flow: ${coherenceScore}/10`
    })

    gates.push({
      gateName: 'Relevance',
      passed: relevanceScore >= 6,
      score: relevanceScore,
      maxScore: 10,
      feedback: `Book alignment: ${relevanceScore}/10`
    })

    gates.push({
      gateName: 'Clarity',
      passed: clarityScore >= 6,
      score: clarityScore,
      maxScore: 10,
      feedback: `Understandability: ${clarityScore}/10`
    })

    gates.push({
      gateName: 'Engagement',
      passed: engagementScore >= 6,
      score: engagementScore,
      maxScore: 10,
      feedback: `Reader interest: ${engagementScore}/10`
    })

    gates.push({
      gateName: 'Completeness',
      passed: completenessScore >= 6,
      score: completenessScore,
      maxScore: 10,
      feedback: `Topic coverage: ${completenessScore}/10`
    })

    // Gate 5: Questions Addressed
    if (questionsToAddress.length > 0) {
      const questionsPrompt = `Check if this chapter addresses these reader questions.

CHAPTER:
${content.substring(0, 1500)}

QUESTIONS:
${questionsToAddress.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For each question, respond YES or NO:
${questionsToAddress.map((_, i) => `Q${i + 1}: [YES/NO]`).join('\n')}`

      const questionsResponse = await this.complete(questionsPrompt, 0.3)

      const addressedCount = questionsToAddress.filter((_, i) =>
        questionsResponse.includes(`Q${i + 1}: YES`) || questionsResponse.includes(`Q${i + 1}:YES`)
      ).length

      gates.push({
        gateName: 'Reader Questions',
        passed: addressedCount >= questionsToAddress.length * 0.5,
        score: Math.round((addressedCount / questionsToAddress.length) * 10),
        maxScore: 10,
        feedback: `Addressed ${addressedCount}/${questionsToAddress.length} questions`
      })
    }

    const totalScore = gates.reduce((sum, g) => sum + g.score, 0)
    const maxPossibleScore = gates.reduce((sum, g) => sum + g.maxScore, 0)
    const overallPassed = totalScore >= maxPossibleScore * 0.6 && blockingIssues.length === 0

    return {
      overallPassed,
      totalScore,
      maxPossibleScore,
      gates,
      blockingIssues,
      revisionSuggestions
    }
  }

  async extractChapterMetadata(content: string, chapterTitle: string): Promise<{
    summary: string
    keyPoints: string[]
    conceptsIntroduced: string[]
    decisionsStatements: string[]
  }> {
    const metadataPrompt = `Extract metadata from this chapter.

CHAPTER: "${chapterTitle}"

CONTENT:
${content.substring(0, 2000)}

Provide:
1. SUMMARY: A 50-word summary
2. KEY_POINTS: 3-5 main takeaways (one per line, starting with -)
3. CONCEPTS: New terms or concepts introduced (one per line, starting with -)
4. DECISIONS: Any definitive statements or positions taken (one per line, starting with -)

Format exactly as shown.`

    const response = await this.complete(metadataPrompt, 0.5)

    const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=KEY_POINTS:|$)/is)
    const summary = summaryMatch ? summaryMatch[1].trim() : 'No summary available'

    const keyPointsMatch = response.match(/KEY_POINTS:\s*(.+?)(?=CONCEPTS:|$)/is)
    const keyPoints = keyPointsMatch
      ? keyPointsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
      : []

    const conceptsMatch = response.match(/CONCEPTS:\s*(.+?)(?=DECISIONS:|$)/is)
    const conceptsIntroduced = conceptsMatch
      ? conceptsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
      : []

    const decisionsMatch = response.match(/DECISIONS:\s*(.+?)$/is)
    const decisionsStatements = decisionsMatch
      ? decisionsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
      : []

    return {
      summary,
      keyPoints: keyPoints.slice(0, 5),
      conceptsIntroduced: conceptsIntroduced.slice(0, 5),
      decisionsStatements: decisionsStatements.slice(0, 3)
    }
  }

  async generateStyleGuide(chapterContent: string): Promise<{
    voiceDescription: string
    sentenceStyleExamples: string[]
    vocabularyLevel: 'simple' | 'intermediate' | 'advanced' | 'technical'
    formalityLevel: 'casual' | 'conversational' | 'formal' | 'academic'
  }> {
    const stylePrompt = `Analyze the writing style of this chapter.

CONTENT:
${chapterContent.substring(0, 1500)}

Analyze:
1. VOICE: Describe the author's voice (1-2 sentences)
2. EXAMPLE1: A sentence that represents the style
3. EXAMPLE2: Another representative sentence
4. EXAMPLE3: Another representative sentence
5. VOCABULARY: Choose: simple, intermediate, advanced, technical
6. FORMALITY: Choose: casual, conversational, formal, academic`

    const response = await this.complete(stylePrompt, 0.5)

    const voiceMatch = response.match(/VOICE:\s*(.+?)(?=EXAMPLE|$)/is)
    const voiceDescription = voiceMatch ? voiceMatch[1].trim() : 'Clear and informative'

    const examples: string[] = []
    for (let i = 1; i <= 3; i++) {
      const match = response.match(new RegExp(`EXAMPLE${i}:\\s*(.+?)(?=EXAMPLE|VOCABULARY|$)`, 'is'))
      if (match) examples.push(match[1].trim())
    }

    const vocabMatch = response.match(/VOCABULARY:\s*(\w+)/i)
    const vocabularyLevel = (['simple', 'intermediate', 'advanced', 'technical'].includes(vocabMatch?.[1]?.toLowerCase() || '')
      ? vocabMatch![1].toLowerCase()
      : 'intermediate') as any

    const formalityMatch = response.match(/FORMALITY:\s*(\w+)/i)
    const formalityLevel = (['casual', 'conversational', 'formal', 'academic'].includes(formalityMatch?.[1]?.toLowerCase() || '')
      ? formalityMatch![1].toLowerCase()
      : 'conversational') as any

    return {
      voiceDescription,
      sentenceStyleExamples: examples,
      vocabularyLevel,
      formalityLevel
    }
  }

  async initializeBookContext(
    bookTitle: string,
    bookDescription: string,
    targetAudience?: string
  ): Promise<{
    thesis: string
    coreArgument: string
    targetAudience: string
    bookArchetype: 'how-to' | 'narrative' | 'reference' | 'memoir' | 'educational'
    toneMarkers: string[]
  }> {
    const contextPrompt = `Analyze this book and define its core context.

TITLE: "${bookTitle}"
DESCRIPTION: ${bookDescription}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}

Define:
1. THESIS: The core thesis (1-2 sentences)
2. CORE_ARGUMENT: What the book proves or teaches (1 sentence)
3. AUDIENCE: Specific target reader profile
4. ARCHETYPE: Choose: how-to, narrative, reference, memoir, educational
5. TONE: List 3-5 tone markers

Format:
THESIS: [thesis]
CORE_ARGUMENT: [argument]
AUDIENCE: [audience]
ARCHETYPE: [type]
TONE: [comma-separated list]`

    const response = await this.complete(contextPrompt, 0.6)

    const thesisMatch = response.match(/THESIS:\s*(.+?)(?=CORE_ARGUMENT|$)/is)
    const argumentMatch = response.match(/CORE_ARGUMENT:\s*(.+?)(?=AUDIENCE|$)/is)
    const audienceMatch = response.match(/AUDIENCE:\s*(.+?)(?=ARCHETYPE|$)/is)
    const archetypeMatch = response.match(/ARCHETYPE:\s*(\w+)/i)
    const toneMatch = response.match(/TONE:\s*(.+?)$/is)

    const validArchetypes = ['how-to', 'narrative', 'reference', 'memoir', 'educational']
    const archetype = validArchetypes.includes(archetypeMatch?.[1]?.toLowerCase() || '')
      ? archetypeMatch![1].toLowerCase() as any
      : 'educational'

    return {
      thesis: thesisMatch?.[1]?.trim() || 'Explore and explain the subject matter thoroughly',
      coreArgument: argumentMatch?.[1]?.trim() || 'Provide valuable insights to readers',
      targetAudience: audienceMatch?.[1]?.trim() || targetAudience || 'General readers interested in the topic',
      bookArchetype: archetype,
      toneMarkers: toneMatch?.[1]?.split(',').map(t => t.trim()).filter(t => t) || ['informative', 'engaging']
    }
  }

  // Core completion method
  private async complete(prompt: string, temperature: number = 0.7): Promise<string> {
    const url = this.getActiveUrl()
    const model = this.getActiveModel()

    if (this.config.providerType === 'ollama') {
      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          temperature,
          options: {
            num_predict: 512,
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as any
      return data.response || ''
    } else {
      const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'local-model',
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: 512,
          stream: false
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as any
      return data.choices?.[0]?.message?.content || ''
    }
  }

  // Config management
  getConfig(): AIServiceConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  switchProvider(provider: AIProviderType): void {
    this.config.providerType = provider
    this.saveConfig()
  }

  getActiveProvider(): AIProviderType {
    return this.config.providerType
  }

  setModel(model: string): void {
    if (this.config.providerType === 'ollama') {
      this.config.ollamaModel = model
    } else {
      this.config.lmstudioModel = model
    }
    this.saveConfig()
  }

  // Parsing helpers
  private parseSingleBookIdea(text: string, niche: string): BookIdea | null {
    try {
      const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i)
      const hookMatch = text.match(/HOOK:\s*(.+?)(?:\n(?:AUDIENCE|THEMES|UNIQUE|TONE):|$)/is)
      const audienceMatch = text.match(/AUDIENCE:\s*(.+?)(?:\n|$)/i)
      const themesMatch = text.match(/THEMES:\s*(.+?)(?:\n|$)/i)
      const uniqueMatch = text.match(/UNIQUE:\s*(.+?)(?:\n|$)/is)
      const toneMatch = text.match(/TONE:\s*(.+?)(?:\n|$)/i)

      if (!titleMatch || !hookMatch) return null

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
    } catch {
      return null
    }
  }

  private parseChapterList(text: string, expectedCount: number): string[] {
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
      return Array.from({ length: expectedCount }, (_, i) => `Chapter ${i + 1}: Introduction to Key Concepts`)
    }

    return chapters.slice(0, expectedCount)
  }
}

// Export singleton instance
export const aiService = new AIService()
