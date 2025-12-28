/**
 * AI Audience Service - Orchestrates AI personas to automatically generate questions,
 * vote, and create discussions about book chapters
 */

import { OllamaService } from './ollamaService'
import { AIPersonaService, type AIPersona } from './aiPersonaService'
import { DiscussionRepository } from '../database/repositories/discussionRepository'

export interface AutoGenerationConfig {
  questionsPerPersona: number  // How many questions each persona generates
  votingRounds: number  // How many voting rounds to simulate
  debateDepth: number  // How many rounds of back-and-forth discussion
}

export class AIAudienceService {
  private ollamaService: OllamaService
  private personaService: AIPersonaService
  private discussionRepo: DiscussionRepository

  constructor(
    ollamaService: OllamaService,
    personaService: AIPersonaService,
    discussionRepo: DiscussionRepository
  ) {
    this.ollamaService = ollamaService
    this.personaService = personaService
    this.discussionRepo = discussionRepo
  }

  /**
   * Automatically generate questions from AI personas for a chapter
   */
  async generateAutomaticQuestions(
    chapterId: number,
    chapterTitle: string,
    chapterContent: string,
    config: Partial<AutoGenerationConfig> = {}
  ): Promise<void> {
    const finalConfig: AutoGenerationConfig = {
      questionsPerPersona: config.questionsPerPersona || 2,
      votingRounds: config.votingRounds || 1,
      debateDepth: config.debateDepth || 2
    }

    console.log(`🤖 Starting automated audience interaction for chapter ${chapterId}`)

    // Step 1: Select personas for this chapter
    const personas = this.personaService.selectPersonasForChapter(
      chapterTitle,
      chapterContent,
      6  // Use 6 personas for good diversity
    )

    console.log(`👥 Selected ${personas.length} AI personas:`, personas.map(p => p.name))

    // Step 2: Each persona generates questions (SEQUENTIAL to avoid timeout)
    console.log(`\n🎭 Generating questions from each persona sequentially...`)
    let successCount = 0
    for (let i = 0; i < personas.length; i++) {
      const persona = personas[i]
      try {
        console.log(`   [${i + 1}/${personas.length}] ${persona.name} is reading and asking questions...`)
        await this.generateQuestionsFromPersona(
          persona,
          chapterId,
          chapterTitle,
          chapterContent,
          finalConfig.questionsPerPersona
        )
        successCount++
        console.log(`   ✅ ${persona.name} completed (${successCount}/${personas.length})`)
      } catch (error) {
        console.warn(`   ⚠️ ${persona.name} failed to generate questions (continuing with others):`, error instanceof Error ? error.message : error)
        // Continue with other personas even if one fails
      }
    }

    console.log(`\n✅ Question generation complete: ${successCount}/${personas.length} personas succeeded`)

    // Step 3: Simulate voting rounds
    for (let round = 0; round < finalConfig.votingRounds; round++) {
      await this.simulateVotingRound(chapterId, personas)
    }

    // Step 4: Generate debate/discussion on top questions
    await this.generateDebates(chapterId, personas, finalConfig.debateDepth)

    console.log(`✅ Automated audience interaction complete for chapter ${chapterId}`)
  }

  /**
   * Generate questions from a specific persona's perspective
   */
  private async generateQuestionsFromPersona(
    persona: AIPersona,
    chapterId: number,
    chapterTitle: string,
    chapterContent: string,
    count: number
  ): Promise<void> {
    const prompt = this.buildQuestionGenerationPrompt(
      persona,
      chapterTitle,
      chapterContent,
      count
    )

    const response = await this.ollamaService.complete(prompt, undefined, 0.8, 'question')
    const questions = this.parseQuestionsFromResponse(response)

    // Save each question to the database
    for (const questionText of questions.slice(0, count)) {
      this.discussionRepo.createQuestion(chapterId, questionText, persona.name)
      console.log(`      ❓ "${questionText.substring(0, 70)}..."`)
    }
  }

  /**
   * Build the prompt for generating persona-specific questions
   */
  private buildQuestionGenerationPrompt(
    persona: AIPersona,
    chapterTitle: string,
    chapterContent: string,
    count: number
  ): string {
    const contentPreview = chapterContent.substring(0, 2000) + '...'

    return `You are ${persona.name}, ${persona.role}.

YOUR PERSONALITY: ${persona.personality}
YOUR QUESTIONING STYLE: ${persona.questioningStyle}
YOUR INTERESTS: ${persona.interests.join(', ')}

You just read this chapter:
TITLE: "${chapterTitle}"
CONTENT PREVIEW:
${contentPreview}

Generate ${count} insightful questions that ${persona.name} would ask about this chapter.

Requirements:
- Stay true to your personality and questioning style
- Focus on your areas of interest
- Ask questions that would spark valuable discussion
- Make questions specific to the chapter content
- Keep questions concise (1-2 sentences each)

Format your response as a numbered list:
1. [First question]
2. [Second question]
...

Only output the numbered list of questions, nothing else.`
  }

  /**
   * Parse questions from LLM response
   */
  private parseQuestionsFromResponse(response: string): string[] {
    const lines = response.split('\n').filter(line => line.trim())
    const questions: string[] = []

    for (const line of lines) {
      // Match numbered list items: "1. Question" or "1) Question"
      const match = line.match(/^\d+[\.)]\s*(.+)$/)
      if (match && match[1]) {
        questions.push(match[1].trim())
      }
    }

    return questions
  }

  /**
   * Simulate a voting round where personas vote on questions
   */
  private async simulateVotingRound(chapterId: number, personas: AIPersona[]): Promise<void> {
    const questions = this.discussionRepo.getQuestionsByChapter(chapterId, 'recent')

    for (const question of questions) {
      for (const persona of personas) {
        // Check if this persona would vote for this question
        if (this.personaService.wouldVoteForQuestion(persona, question.text)) {
          const voterIdentifier = this.personaService.getVoterIdentifier(persona)

          // Only vote if haven't already
          if (!this.discussionRepo.hasVoted(question.id, voterIdentifier)) {
            this.discussionRepo.addVote(question.id, voterIdentifier)
          }
        }
      }
    }

    console.log(`🗳️  Voting round complete - ${personas.length} personas voted`)
  }

  /**
   * Generate debate discussions on top questions
   */
  private async generateDebates(
    chapterId: number,
    personas: AIPersona[],
    depth: number
  ): Promise<void> {
    // Get top 3 questions by vote count
    const topQuestions = this.discussionRepo.getTopQuestions(chapterId, 3)

    for (const question of topQuestions) {
      console.log(`💬 Generating debate for: ${question.text.substring(0, 60)}...`)

      // Select 2-3 personas to debate this question
      const debaters = this.selectDebatersForQuestion(question.text, personas)

      // Generate initial answers from each debater
      for (const debater of debaters) {
        const answer = await this.generatePersonaAnswer(
          debater,
          question.text,
          question.text  // Initial context is just the question
        )

        if (answer) {
          this.discussionRepo.createAnswer(question.id, answer, false)
          console.log(`  💭 ${debater.name}: ${answer.substring(0, 80)}...`)
        }
      }

      // Generate follow-up rounds of debate
      for (let round = 1; round < depth; round++) {
        const existingAnswers = this.discussionRepo.getAnswersByQuestion(question.id)
        const debateContext = existingAnswers.map(a => a.text).join('\n\n')

        for (const debater of debaters) {
          const followUp = await this.generatePersonaFollowUp(
            debater,
            question.text,
            debateContext
          )

          if (followUp) {
            this.discussionRepo.createAnswer(question.id, followUp, false)
            console.log(`  🔄 ${debater.name}: ${followUp.substring(0, 80)}...`)
          }
        }
      }
    }

    // Mark questions as having discussion
    for (const question of topQuestions) {
      this.discussionRepo.updateQuestion(question.id, { status: 'answered' })
    }
  }

  /**
   * Select personas who would be interested in debating this question
   */
  private selectDebatersForQuestion(questionText: string, personas: AIPersona[]): AIPersona[] {
    const interested = personas.filter(p =>
      this.personaService.wouldVoteForQuestion(p, questionText)
    )

    // If fewer than 2 interested, add some anyway
    if (interested.length < 2) {
      const remaining = personas.filter(p => !interested.includes(p))
      interested.push(...remaining.slice(0, 2 - interested.length))
    }

    // Return 2-3 debaters
    return interested.slice(0, 3)
  }

  /**
   * Generate an answer from a persona's perspective
   */
  private async generatePersonaAnswer(
    persona: AIPersona,
    question: string,
    context: string
  ): Promise<string | null> {
    const prompt = `You are ${persona.name}, ${persona.role}.

YOUR PERSONALITY: ${persona.personality}

QUESTION: ${question}

Provide a thoughtful answer from your perspective. Stay true to your personality and interests.
Keep your answer concise (2-4 sentences).

Your answer:`

    try {
      const response = await this.ollamaService.complete(prompt, undefined, 0.75, 'answer')
      return response.trim()
    } catch (error) {
      console.error(`Error generating answer from ${persona.name}:`, error)
      return null
    }
  }

  /**
   * Generate a follow-up response in an ongoing debate
   */
  private async generatePersonaFollowUp(
    persona: AIPersona,
    question: string,
    debateContext: string
  ): Promise<string | null> {
    const prompt = `You are ${persona.name}, ${persona.role}.

YOUR PERSONALITY: ${persona.personality}

ORIGINAL QUESTION: ${question}

DEBATE SO FAR:
${debateContext}

Provide a follow-up response that builds on, challenges, or synthesizes the discussion.
Stay true to your personality. Keep it concise (2-3 sentences).

Your response:`

    try {
      const response = await this.ollamaService.complete(prompt, undefined, 0.75, 'answer')
      return response.trim()
    } catch (error) {
      console.error(`Error generating follow-up from ${persona.name}:`, error)
      return null
    }
  }
}
