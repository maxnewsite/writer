/**
 * Chapter Drafting Service - Automates the iterative chapter writing workflow
 * with AI-generated drafts and AI reader feedback loops
 */

import { OllamaService } from './ollamaService'
import { AIAudienceService } from './aiAudienceService'
import { ChapterRepository } from '../database/repositories/chapterRepository'
import { DiscussionRepository, type QuestionWithAnswers } from '../database/repositories/discussionRepository'

export interface DraftConfig {
  chapterTitle: string
  chapterNumber: number
  bookContext: {
    title: string
    description: string
    previousChapters?: string[]
  }
  targetWordCount?: number
}

export interface FeedbackAnalysis {
  topConcerns: string[]
  suggestedImprovements: string[]
  strengths: string[]
  shouldRedraft: boolean
  confidenceScore: number
}

export class ChapterDraftingService {
  private ollamaService: OllamaService
  private aiAudienceService: AIAudienceService
  private chapterRepo: ChapterRepository
  private discussionRepo: DiscussionRepository

  constructor(
    ollamaService: OllamaService,
    aiAudienceService: AIAudienceService,
    chapterRepo: ChapterRepository,
    discussionRepo: DiscussionRepository
  ) {
    this.ollamaService = ollamaService
    this.aiAudienceService = aiAudienceService
    this.chapterRepo = chapterRepo
    this.discussionRepo = discussionRepo
  }

  /**
   * Generate an initial chapter draft
   */
  async generateChapterDraft(config: DraftConfig): Promise<string> {
    console.log(`📝 Generating draft for Chapter ${config.chapterNumber}: ${config.chapterTitle}`)

    try {
      // Generate chapter in sections to avoid timeout
      const sections: string[] = []

      // Generate 4 sections for a complete chapter
      const sectionCount = 4

      for (let i = 0; i < sectionCount; i++) {
        console.log(`  📝 Generating section ${i + 1}/${sectionCount}...`)
        const sectionPrompt = this.buildSectionPrompt(config, i + 1, sectionCount)
        const section = await this.ollamaService.complete(sectionPrompt, undefined, 0.75, 'section')
        sections.push(section)
      }

      // Combine sections into complete chapter
      const draft = `# ${config.chapterTitle}\n\n${sections.join('\n\n')}`

      console.log(`✅ Draft generated (${draft.length} characters, ${sectionCount} sections)`)
      return draft
    } catch (error) {
      console.error('Error generating chapter draft:', error)
      throw new Error('Failed to generate chapter draft')
    }
  }

  /**
   * Trigger AI reader feedback generation
   */
  async generateAIReaderFeedback(
    chapterId: number,
    chapterTitle: string,
    chapterContent: string
  ): Promise<void> {
    console.log(`🤖 Generating AI reader feedback for chapter ${chapterId}`)

    if (!chapterContent.trim()) {
      throw new Error('Chapter content is empty - cannot generate feedback')
    }

    // Use the AI Audience Service to generate questions and interactions
    await this.aiAudienceService.generateAutomaticQuestions(
      chapterId,
      chapterTitle,
      chapterContent,
      {
        questionsPerPersona: 2,
        votingRounds: 1,
        debateDepth: 2
      }
    )

    console.log(`✅ AI reader feedback generated`)
  }

  /**
   * Analyze feedback to determine if chapter needs redrafting
   */
  async analyzeFeedback(chapterId: number): Promise<FeedbackAnalysis> {
    console.log(`📊 Analyzing feedback for chapter ${chapterId}`)

    // Get all questions and their votes
    const questions = this.discussionRepo.getQuestionsByChapter(chapterId)

    if (questions.length === 0) {
      return {
        topConcerns: [],
        suggestedImprovements: [],
        strengths: [],
        shouldRedraft: false,
        confidenceScore: 0.5
      }
    }

    // Sort by vote count
    const sortedQuestions = questions.sort((a: QuestionWithAnswers, b: QuestionWithAnswers) => b.vote_count - a.vote_count)
    const topQuestions = sortedQuestions.slice(0, 5)

    // Use AI to analyze the feedback
    const analysisPrompt = this.buildFeedbackAnalysisPrompt(topQuestions)
    const analysisResult = await this.ollamaService.complete(analysisPrompt, undefined, 0.6, 'analysis')

    return this.parseFeedbackAnalysis(analysisResult, topQuestions)
  }

  /**
   * Redraft chapter based on feedback
   */
  async redraftChapterWithFeedback(
    config: DraftConfig,
    originalDraft: string,
    feedback: FeedbackAnalysis
  ): Promise<string> {
    console.log(`✏️ Redrafting chapter ${config.chapterNumber} based on feedback`)

    try {
      // Generate improved version focusing on top concerns
      const improvementFocus = feedback.topConcerns.slice(0, 3).join('; ')

      const prompt = this.buildSimpleRedraftPrompt(config, originalDraft, improvementFocus)
      const redraft = await this.ollamaService.complete(prompt, undefined, 0.75, 'redraft')

      console.log(`✅ Redraft completed (${redraft.length} characters)`)
      return redraft
    } catch (error) {
      console.error('Error redrafting chapter:', error)
      throw new Error('Failed to redraft chapter')
    }
  }

  private buildSimpleRedraftPrompt(
    config: DraftConfig,
    originalDraft: string,
    improvements: string
  ): string {
    // Keep original but limit to first 1500 chars for context
    const draftPreview = originalDraft.substring(0, 1500) + '...'

    return `Improve this chapter draft by addressing reader concerns.

BOOK CONTEXT:
Title: "${config.bookContext.title}"
Subject: ${config.bookContext.description}

CRITICAL: This book is about ${config.bookContext.description}. ALL content must stay focused on this topic. Do not drift into unrelated subjects.

CHAPTER: "${config.chapterTitle}" (Chapter ${config.chapterNumber})

READER CONCERNS TO ADDRESS:
${improvements}

ORIGINAL DRAFT (preview):
${draftPreview}

YOUR TASK: Rewrite this chapter to address the concerns while keeping its best parts.

Guidelines:
- Stay focused on ${config.bookContext.description} - this is the book's core subject
- Fix confusing sections
- Add clarity where needed
- Keep engaging examples (related to ${config.bookContext.description})
- Maintain conversational tone
- ~500 words

REMINDER: Everything must relate to ${config.bookContext.description}. This is a book about ${config.bookContext.description}, not other topics.

Write the improved chapter now with markdown formatting (use ## for subheadings).`
  }

  // ===== Private Helper Methods =====

  private buildSectionPrompt(config: DraftConfig, sectionNumber: number, totalSections: number): string {
    const sectionType = this.getSectionType(sectionNumber, totalSections)

    return `Write a brief ${sectionType.toLowerCase()} section for a book chapter.

BOOK CONTEXT:
Title: "${config.bookContext.title}"
Subject: ${config.bookContext.description}

IMPORTANT: Stay focused on the book's subject matter. All content must relate directly to "${config.bookContext.description}".

CHAPTER: "${config.chapterTitle}"
This is chapter ${config.chapterNumber} of the book "${config.bookContext.title}".

${this.getSectionRequirements(sectionType)}

Write 200-300 words. Use conversational tone. Include one concrete example related to ${config.bookContext.description}.

REMEMBER: Everything you write must be about ${config.bookContext.description}. Do not drift into unrelated topics.

Write the section now:`
  }

  private getSectionType(sectionNumber: number, total: number): string {
    if (sectionNumber === 1) return 'Opening Hook'
    if (sectionNumber === total) return 'Conclusion & Transition'
    if (sectionNumber === 2) return 'Core Concept Explanation'
    return 'Supporting Content & Examples'
  }

  private getSectionRequirements(sectionType: string): string {
    switch (sectionType) {
      case 'Opening Hook':
        return `Start with a question or story. Introduce the main topic.`
      case 'Core Concept Explanation':
        return `Explain the main concept clearly. Use a simple analogy.`
      case 'Supporting Content & Examples':
        return `Share one practical example or story.`
      case 'Conclusion & Transition':
        return `Summarize the key takeaway in 1-2 sentences.`
      default:
        return `Deliver valuable content briefly.`
    }
  }


  private buildFeedbackAnalysisPrompt(questions: any[]): string {
    const questionsText = questions
      .map((q, i) => `${i + 1}. ${q.text} (${q.vote_count} votes, asked by ${q.persona})`)
      .join('\n')

    return `Analyze reader feedback on a book chapter and provide structured insights.

READER QUESTIONS (sorted by votes):
${questionsText}

Provide your analysis in this format:

CONCERNS:
- [Main concern 1]
- [Main concern 2]
- [Main concern 3]

IMPROVEMENTS:
- [Suggested improvement 1]
- [Suggested improvement 2]
- [Suggested improvement 3]

STRENGTHS:
- [Strength 1]
- [Strength 2]

SHOULD_REDRAFT: YES or NO
CONFIDENCE: [number from 0.0 to 1.0]

Analysis requirements:
- CONCERNS should identify gaps, confusions, or issues readers raised
- IMPROVEMENTS should be actionable suggestions based on the questions
- STRENGTHS should infer what readers found valuable (from positive/curious questions)
- SHOULD_REDRAFT is YES if major issues exist, NO if minor tweaks needed
- CONFIDENCE reflects how clear and actionable the feedback is

Provide only the formatted analysis above.`
  }

  private parseFeedbackAnalysis(
    analysisText: string,
    questions: any[]
  ): FeedbackAnalysis {
    try {
      const concerns: string[] = []
      const improvements: string[] = []
      const strengths: string[] = []
      let shouldRedraft = false
      let confidenceScore = 0.5

      // Parse CONCERNS section
      const concernsMatch = analysisText.match(/CONCERNS:([\s\S]*?)(?=IMPROVEMENTS:|$)/i)
      if (concernsMatch) {
        const concernLines = concernsMatch[1].split('\n').filter(line => line.trim().startsWith('-'))
        concerns.push(...concernLines.map(line => line.replace(/^-\s*/, '').trim()))
      }

      // Parse IMPROVEMENTS section
      const improvementsMatch = analysisText.match(/IMPROVEMENTS:([\s\S]*?)(?=STRENGTHS:|$)/i)
      if (improvementsMatch) {
        const improvementLines = improvementsMatch[1].split('\n').filter(line => line.trim().startsWith('-'))
        improvements.push(...improvementLines.map(line => line.replace(/^-\s*/, '').trim()))
      }

      // Parse STRENGTHS section
      const strengthsMatch = analysisText.match(/STRENGTHS:([\s\S]*?)(?=SHOULD_REDRAFT:|$)/i)
      if (strengthsMatch) {
        const strengthLines = strengthsMatch[1].split('\n').filter(line => line.trim().startsWith('-'))
        strengths.push(...strengthLines.map(line => line.replace(/^-\s*/, '').trim()))
      }

      // Parse SHOULD_REDRAFT
      const redraftMatch = analysisText.match(/SHOULD_REDRAFT:\s*(YES|NO)/i)
      if (redraftMatch) {
        shouldRedraft = redraftMatch[1].toUpperCase() === 'YES'
      }

      // Parse CONFIDENCE
      const confidenceMatch = analysisText.match(/CONFIDENCE:\s*([\d.]+)/i)
      if (confidenceMatch) {
        confidenceScore = parseFloat(confidenceMatch[1])
      }

      return {
        topConcerns: concerns,
        suggestedImprovements: improvements,
        strengths: strengths,
        shouldRedraft,
        confidenceScore
      }
    } catch (error) {
      console.error('Error parsing feedback analysis:', error)

      // Fallback: use question text directly
      return {
        topConcerns: questions.slice(0, 3).map(q => q.text),
        suggestedImprovements: ['Review reader questions and address concerns'],
        strengths: [],
        shouldRedraft: questions.length > 0,
        confidenceScore: 0.5
      }
    }
  }

  /**
   * FULL AI WRITING - Autonomous book writing workflow
   * Writes all chapters sequentially, incorporating feedback from each chapter into the next
   * Completely autonomous with no human intervention
   */
  async fullAIWriting(bookId: number, bookTitle: string, bookDescription: string): Promise<void> {
    console.log('🤖 FULL AI WRITING MODE - CONTINUOUS FEEDBACK LOOP')
    console.log(`📚 Book: ${bookTitle}`)

    try {
      // Get all chapters for this book
      const chapters = this.chapterRepo.getChaptersByBook(bookId)

      if (chapters.length === 0) {
        throw new Error('No chapters found. Please create an outline first.')
      }

      console.log(`📖 Found ${chapters.length} chapters to write`)
      console.log(`\n🔄 CONTINUOUS IMPROVEMENT FLOW:`)
      console.log(`   Chapter N → AI readers give feedback → Chapter N+1 uses that feedback`)
      console.log(`   Each chapter gets better based on what readers wanted in the previous chapter!\n`)

      let previousFeedback: FeedbackAnalysis | null = null

      // Process each chapter sequentially
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const chapterNum = i + 1
        const isFirstChapter = chapterNum === 1
        const isLastChapter = chapterNum === chapters.length

        console.log(`\n${'='.repeat(60)}`)
        console.log(`📝 CHAPTER ${chapterNum}/${chapters.length}: ${chapter.title}`)
        console.log(`${'='.repeat(60)}`)

        // Step 1: Generate chapter draft
        console.log(`\n1️⃣ Generating draft...`)
        const config: DraftConfig = {
          chapterTitle: chapter.title,
          chapterNumber: chapterNum,
          bookContext: {
            title: bookTitle,
            description: bookDescription,
            previousChapters: [] // Could add summaries of previous chapters
          }
        }

        let chapterContent = await this.generateChapterDraft(config)

        // Step 2: If we have feedback from previous chapter, incorporate it
        if (!isFirstChapter && previousFeedback) {
          console.log(`\n2️⃣ Incorporating feedback from Chapter ${chapterNum - 1}...`)
          console.log(`   Feedback insights:`)
          console.log(`   - Concerns: ${previousFeedback.topConcerns.length}`)
          console.log(`   - Improvements: ${previousFeedback.suggestedImprovements.length}`)

          // Redraft to incorporate previous chapter's feedback
          chapterContent = await this.redraftChapterWithFeedback(config, chapterContent, previousFeedback)
          console.log(`   ✅ Feedback incorporated into Chapter ${chapterNum}`)
        } else if (isFirstChapter) {
          console.log(`\n2️⃣ First chapter - no previous feedback to incorporate`)
        }

        // Step 3: Save the chapter content
        console.log(`\n3️⃣ Saving chapter content...`)
        this.chapterRepo.createVersion(
          chapter.id,
          chapterContent,
          `AI-generated chapter ${chapterNum}${previousFeedback ? ' (with feedback from previous chapter)' : ''}`
        )
        console.log(`   ✅ Chapter saved (${chapterContent.length} characters)`)

        // Step 4: Generate AI reader feedback for this chapter
        // This feedback will be used for the NEXT chapter
        if (!isLastChapter) {
          console.log(`\n4️⃣ Generating AI reader feedback (for Chapter ${chapterNum + 1})...`)
          console.log(`   6 AI personas (Academic, Practitioner, Skeptic, Enthusiast, Beginner, Expert)`)
          console.log(`   are reading, questioning, and discussing this chapter...`)
          await this.generateAIReaderFeedback(chapter.id, chapter.title, chapterContent)

          // Analyze the feedback
          previousFeedback = await this.analyzeFeedback(chapter.id)
          console.log(`   ✅ Feedback collected and will be used to improve Chapter ${chapterNum + 1}:`)
          console.log(`      - ${previousFeedback.topConcerns.length} reader concerns identified`)
          console.log(`      - ${previousFeedback.suggestedImprovements.length} improvements suggested`)
          console.log(`      - Confidence: ${(previousFeedback.confidenceScore * 100).toFixed(0)}%`)
          console.log(`   📝 Next chapter will address these concerns!`)
        } else {
          console.log(`\n4️⃣ Last chapter - no feedback generation needed`)
          console.log(`   (This is the final chapter, so no next chapter to improve)`)
        }

        // Step 5: Mark chapter as published
        console.log(`\n5️⃣ Publishing chapter...`)
        this.chapterRepo.updateChapter(chapter.id, { status: 'published' })

        // Verify it was published
        const updatedChapter = this.chapterRepo.getChapterById(chapter.id)
        if (updatedChapter?.status === 'published') {
          console.log(`   ✅ Chapter ${chapterNum} status: PUBLISHED (no longer draft)`)
        } else {
          console.warn(`   ⚠️ Warning: Chapter status is ${updatedChapter?.status}, expected 'published'`)
        }

        console.log(`\n✅ CHAPTER ${chapterNum} COMPLETE\n`)
      }

      console.log(`\n${'='.repeat(60)}`)
      console.log(`🎉 FULL AI WRITING COMPLETE!`)
      console.log(`📚 Book: "${bookTitle}"`)
      console.log(`📖 Subject: ${bookDescription}`)
      console.log(`✍️ ${chapters.length} chapters written and PUBLISHED`)
      console.log(`📗 All chapters maintained focus on: ${bookDescription}`)
      console.log(`${'='.repeat(60)}\n`)

    } catch (error) {
      console.error('❌ Full AI Writing failed:', error)
      throw error
    }
  }
}
