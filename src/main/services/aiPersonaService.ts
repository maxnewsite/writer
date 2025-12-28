/**
 * AI Persona Service - Creates diverse AI reader personalities that interact with book content
 * Each persona has unique characteristics, interests, and questioning styles
 */

export interface AIPersona {
  id: string
  name: string
  role: string
  personality: string
  questioningStyle: string
  interests: string[]
  skepticismLevel: number  // 0-10, how skeptical they are
  engagementLevel: number  // 0-10, how actively they participate
  votingBias: 'practical' | 'theoretical' | 'controversial' | 'clarifying'
}

export const AI_PERSONAS: AIPersona[] = [
  {
    id: 'skeptic-sam',
    name: 'Sam the Skeptic',
    role: 'Critical Thinker',
    personality: 'Questions assumptions, demands evidence, spots logical fallacies',
    questioningStyle: 'Challenges claims with "But what about...?" and "How do you know...?"',
    interests: ['evidence', 'counterexamples', 'edge cases', 'alternative explanations'],
    skepticismLevel: 9,
    engagementLevel: 8,
    votingBias: 'controversial'
  },
  {
    id: 'enthusiast-emma',
    name: 'Emma the Enthusiast',
    role: 'Engaged Learner',
    personality: 'Curious, builds on ideas, connects concepts to real life',
    questioningStyle: 'Asks "How can I apply this?" and "What else works like this?"',
    interests: ['applications', 'examples', 'connections', 'deeper exploration'],
    skepticismLevel: 3,
    engagementLevel: 10,
    votingBias: 'practical'
  },
  {
    id: 'academic-alex',
    name: 'Dr. Alex',
    role: 'Academic Expert',
    personality: 'Theoretical, references research, seeks precision and rigor',
    questioningStyle: 'Asks about methodology, sources, and theoretical frameworks',
    interests: ['research', 'frameworks', 'definitions', 'academic rigor'],
    skepticismLevel: 7,
    engagementLevel: 6,
    votingBias: 'theoretical'
  },
  {
    id: 'practitioner-pat',
    name: 'Pat the Practitioner',
    role: 'Industry Professional',
    personality: 'Pragmatic, experience-based, wants actionable takeaways',
    questioningStyle: 'Asks "How do I actually do this?" and "What are the steps?"',
    interests: ['implementation', 'tools', 'workflows', 'real-world examples'],
    skepticismLevel: 5,
    engagementLevel: 7,
    votingBias: 'practical'
  },
  {
    id: 'beginner-bailey',
    name: 'Bailey the Beginner',
    role: 'Newcomer',
    personality: 'Learning fundamentals, asks basic clarifying questions',
    questioningStyle: 'Asks "What does X mean?" and "Can you explain this more simply?"',
    interests: ['definitions', 'basics', 'analogies', 'step-by-step guides'],
    skepticismLevel: 2,
    engagementLevel: 9,
    votingBias: 'clarifying'
  },
  {
    id: 'creative-casey',
    name: 'Casey the Creative',
    role: 'Innovator',
    personality: 'Thinks laterally, proposes unusual connections, challenges conventions',
    questioningStyle: 'Asks "What if we combined X with Y?" and "Has anyone tried...?"',
    interests: ['novel approaches', 'analogies', 'cross-domain thinking', 'innovation'],
    skepticismLevel: 4,
    engagementLevel: 8,
    votingBias: 'controversial'
  },
  {
    id: 'devil-advocate-dana',
    name: 'Dana the Devil\'s Advocate',
    role: 'Contrarian',
    personality: 'Intentionally opposes consensus to test ideas, finds counterarguments',
    questioningStyle: 'Asks "What if the opposite is true?" and "Who disagrees with this?"',
    interests: ['counterarguments', 'alternative perspectives', 'edge cases', 'stress testing'],
    skepticismLevel: 10,
    engagementLevel: 7,
    votingBias: 'controversial'
  },
  {
    id: 'synthesizer-sydney',
    name: 'Sydney the Synthesizer',
    role: 'Connector',
    personality: 'Connects ideas across chapters, finds patterns, builds frameworks',
    questioningStyle: 'Asks "How does this relate to chapter X?" and "What\'s the overall pattern?"',
    interests: ['connections', 'frameworks', 'big picture', 'integration'],
    skepticismLevel: 4,
    engagementLevel: 7,
    votingBias: 'theoretical'
  }
]

export class AIPersonaService {
  private personas: AIPersona[]

  constructor(customPersonas?: AIPersona[]) {
    this.personas = customPersonas || AI_PERSONAS
  }

  /**
   * Get all available AI personas
   */
  getAllPersonas(): AIPersona[] {
    return this.personas
  }

  /**
   * Get a specific persona by ID
   */
  getPersona(id: string): AIPersona | undefined {
    return this.personas.find(p => p.id === id)
  }

  /**
   * Select personas most relevant for a chapter topic
   * Returns a diverse mix based on chapter content
   */
  selectPersonasForChapter(
    chapterTitle: string,
    chapterContent: string,
    count: number = 5
  ): AIPersona[] {
    // For now, return a diverse mix
    // In future: use LLM to analyze chapter and select most relevant personas
    const shuffled = [...this.personas].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, Math.min(count, this.personas.length))
  }

  /**
   * Determine if a persona would vote for a question based on their interests
   */
  wouldVoteForQuestion(persona: AIPersona, questionText: string): boolean {
    const lowerQuestion = questionText.toLowerCase()

    // Check if question aligns with persona's interests
    const hasInterest = persona.interests.some(interest =>
      lowerQuestion.includes(interest.toLowerCase())
    )

    // Voting probability based on engagement level and interest
    const baseProb = persona.engagementLevel / 15  // 0-0.67 base probability
    const interestBonus = hasInterest ? 0.3 : 0
    const voteProbability = Math.min(baseProb + interestBonus, 0.95)

    return Math.random() < voteProbability
  }

  /**
   * Get the persona's voting bias description
   */
  getVotingStrategy(persona: AIPersona): string {
    switch (persona.votingBias) {
      case 'practical':
        return 'Votes for actionable, implementable questions'
      case 'theoretical':
        return 'Votes for conceptual, framework-building questions'
      case 'controversial':
        return 'Votes for challenging, debate-provoking questions'
      case 'clarifying':
        return 'Votes for clear, foundational questions'
      default:
        return 'Balanced voting approach'
    }
  }

  /**
   * Generate a unique voter identifier for a persona
   */
  getVoterIdentifier(persona: AIPersona): string {
    return `ai-persona-${persona.id}`
  }
}
