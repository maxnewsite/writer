/**
 * Research Service for Real-Time Data Gathering
 * Searches the web for current statistics, trends, and data
 * to enhance AI-generated content with real-world information
 */

export interface ResearchResult {
  query: string
  findings: ResearchFinding[]
  timestamp: number
  sourceCount: number
}

export interface ResearchFinding {
  type: 'statistic' | 'trend' | 'fact' | 'quote' | 'study' | 'news'
  content: string
  source?: string
  sourceUrl?: string
  year?: number
  relevanceScore: number
}

export interface ChapterResearch {
  chapterId?: number
  chapterTitle: string
  bookNiche: string
  bookTitle: string
  research: ResearchResult[]
  summary: string
  keyStatistics: string[]
  recentTrends: string[]
  notableQuotes: string[]
  suggestedCitations: string[]
  researchedAt: string
}


class ResearchService {
  private cache: Map<string, ChapterResearch> = new Map()
  private aiConfig: { providerType: string; ollamaUrl: string; ollamaModel: string; lmstudioUrl: string; lmstudioModel: string }

  constructor() {
    // Load AI config for processing research
    const saved = localStorage.getItem('ai-config')
    this.aiConfig = saved ? JSON.parse(saved) : {
      providerType: 'ollama',
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.1:8b',
      lmstudioUrl: 'http://127.0.0.1:1234',
      lmstudioModel: ''
    }
  }

  /**
   * Conduct comprehensive research for a chapter
   */
  async researchForChapter(
    chapterTitle: string,
    chapterDescription: string,
    bookNiche: string,
    bookTitle: string,
    onProgress?: (status: string) => void
  ): Promise<ChapterResearch> {
    const cacheKey = `${bookTitle}-${chapterTitle}`.toLowerCase()

    // Check cache (research valid for 24 hours)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      const age = Date.now() - new Date(cached.researchedAt).getTime()
      if (age < 24 * 60 * 60 * 1000) {
        console.log('📚 Using cached research for:', chapterTitle)
        return cached
      }
    }

    console.log(`\n🔬 Starting Research for: "${chapterTitle}"`)
    onProgress?.('Initiating research...')

    const allFindings: ResearchFinding[] = []
    const researchResults: ResearchResult[] = []

    // Extract key topics from chapter title and description
    const topics = this.extractKeyTopics(chapterTitle, chapterDescription, bookNiche)
    console.log(`  📋 Key topics identified: ${topics.join(', ')}`)

    // Research each topic
    for (const topic of topics.slice(0, 3)) { // Limit to top 3 topics
      onProgress?.(`Researching: ${topic}...`)

      try {
        // Search for statistics
        const statsQuery = `${topic} ${bookNiche} statistics data ${new Date().getFullYear()}`
        const statsFindings = await this.searchAndExtract(statsQuery, 'statistic')
        allFindings.push(...statsFindings)

        // Search for trends
        const trendsQuery = `${topic} ${bookNiche} trends latest ${new Date().getFullYear()}`
        const trendsFindings = await this.searchAndExtract(trendsQuery, 'trend')
        allFindings.push(...trendsFindings)

        // Search for studies/research
        const studiesQuery = `${topic} research study findings ${bookNiche}`
        const studiesFindings = await this.searchAndExtract(studiesQuery, 'study')
        allFindings.push(...studiesFindings)

        researchResults.push({
          query: topic,
          findings: [...statsFindings, ...trendsFindings, ...studiesFindings],
          timestamp: Date.now(),
          sourceCount: statsFindings.length + trendsFindings.length + studiesFindings.length
        })

        console.log(`    ✓ Found ${statsFindings.length + trendsFindings.length + studiesFindings.length} findings for "${topic}"`)
      } catch (error) {
        console.error(`    ✗ Research failed for "${topic}":`, error)
      }
    }

    onProgress?.('Synthesizing research findings...')

    // Process and synthesize all findings
    const synthesis = await this.synthesizeResearch(
      allFindings,
      chapterTitle,
      bookNiche,
      bookTitle
    )

    const chapterResearch: ChapterResearch = {
      chapterTitle,
      bookNiche,
      bookTitle,
      research: researchResults,
      summary: synthesis.summary,
      keyStatistics: synthesis.statistics,
      recentTrends: synthesis.trends,
      notableQuotes: synthesis.quotes,
      suggestedCitations: synthesis.citations,
      researchedAt: new Date().toISOString()
    }

    // Cache the results
    this.cache.set(cacheKey, chapterResearch)

    console.log(`  ✅ Research complete: ${allFindings.length} findings, ${synthesis.statistics.length} statistics, ${synthesis.trends.length} trends`)

    return chapterResearch
  }

  /**
   * Extract key topics from chapter title and description
   */
  private extractKeyTopics(title: string, description: string, niche: string): string[] {
    const combined = `${title} ${description}`.toLowerCase()

    // Remove common words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'chapter', 'introduction', 'conclusion', 'part', 'section', 'how', 'what',
      'why', 'when', 'where', 'who', 'which', 'this', 'that', 'these', 'those',
      'your', 'our', 'their', 'its', 'my', 'his', 'her'
    ])

    // Extract meaningful phrases and words
    const words = combined
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))

    // Get unique topics, prioritizing multi-word phrases from title
    const topics: string[] = []

    // Add the main topic (cleaned title)
    const mainTopic = title
      .replace(/^(chapter\s*\d+:?\s*)/i, '')
      .replace(/[^\w\s]/g, ' ')
      .trim()
    if (mainTopic.length > 3) {
      topics.push(mainTopic)
    }

    // Add individual significant words
    const wordFreq = new Map<string, number>()
    words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1))

    const sortedWords = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 5)

    topics.push(...sortedWords.filter(w => !topics.some(t => t.includes(w))))

    // Add niche context to first topic
    if (topics.length > 0 && !topics[0].toLowerCase().includes(niche.toLowerCase())) {
      topics[0] = `${topics[0]} ${niche}`
    }

    return [...new Set(topics)].slice(0, 4)
  }

  /**
   * Search web and extract findings
   */
  private async searchAndExtract(
    query: string,
    type: ResearchFinding['type']
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = []

    try {
      // Use a CORS proxy or direct fetch to search APIs
      // For web apps, we'll use a public search API approach
      const searchResults = await this.performWebSearch(query)

      if (searchResults.length === 0) {
        return findings
      }

      // Extract relevant information from search results
      for (const result of searchResults.slice(0, 5)) {
        const finding = this.parseSearchResult(result, type)
        if (finding) {
          findings.push(finding)
        }
      }
    } catch (error) {
      console.error('Search failed:', error)
    }

    return findings
  }

  /**
   * Perform web search using available methods
   */
  private async performWebSearch(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    try {
      // Try DuckDuckGo Instant Answer API (CORS-friendly)
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`

      const response = await fetch(ddgUrl, {
        headers: { 'Accept': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()

        // Extract from abstract
        if (data.Abstract) {
          results.push({
            title: data.Heading || query,
            snippet: data.Abstract,
            url: data.AbstractURL || '',
            source: data.AbstractSource || 'DuckDuckGo'
          })
        }

        // Extract from related topics
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, 3)) {
            if (topic.Text) {
              results.push({
                title: topic.Text.split(' - ')[0] || '',
                snippet: topic.Text,
                url: topic.FirstURL || '',
                source: 'DuckDuckGo'
              })
            }
          }
        }

        // Extract from infobox if available
        if (data.Infobox?.content) {
          for (const item of data.Infobox.content.slice(0, 3)) {
            if (item.value && item.label) {
              results.push({
                title: item.label,
                snippet: `${item.label}: ${item.value}`,
                url: '',
                source: 'DuckDuckGo Infobox'
              })
            }
          }
        }
      }
    } catch (error) {
      console.log('DuckDuckGo search failed, trying fallback...')
    }

    // If no results, try Wikipedia API as fallback
    if (results.length === 0) {
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.split(' ').slice(0, 3).join('_'))}`
        const response = await fetch(wikiUrl)

        if (response.ok) {
          const data = await response.json()
          if (data.extract) {
            results.push({
              title: data.title,
              snippet: data.extract,
              url: data.content_urls?.desktop?.page || '',
              source: 'Wikipedia'
            })
          }
        }
      } catch (error) {
        console.log('Wikipedia fallback failed')
      }
    }

    return results
  }

  /**
   * Parse a search result into a research finding
   */
  private parseSearchResult(
    result: SearchResult,
    type: ResearchFinding['type']
  ): ResearchFinding | null {
    if (!result.snippet || result.snippet.length < 20) {
      return null
    }

    // Extract year if mentioned
    const yearMatch = result.snippet.match(/\b(20\d{2})\b/)
    const year = yearMatch ? parseInt(yearMatch[1]) : undefined

    // Calculate relevance based on content quality
    let relevanceScore = 0.5

    // Boost for numbers/statistics
    if (/\d+%|\d+\s*(million|billion|thousand|percent)/i.test(result.snippet)) {
      relevanceScore += 0.2
    }

    // Boost for recent years
    if (year && year >= new Date().getFullYear() - 2) {
      relevanceScore += 0.2
    }

    // Boost for authoritative sources
    if (/research|study|report|survey|analysis/i.test(result.snippet)) {
      relevanceScore += 0.1
    }

    return {
      type,
      content: result.snippet,
      source: result.source,
      sourceUrl: result.url,
      year,
      relevanceScore: Math.min(relevanceScore, 1)
    }
  }

  /**
   * Synthesize research findings into usable format
   */
  private async synthesizeResearch(
    findings: ResearchFinding[],
    chapterTitle: string,
    bookNiche: string,
    bookTitle: string
  ): Promise<{
    summary: string
    statistics: string[]
    trends: string[]
    quotes: string[]
    citations: string[]
  }> {
    // Sort by relevance
    const sortedFindings = [...findings].sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Extract statistics (findings with numbers)
    const statistics = sortedFindings
      .filter(f => /\d+%|\d+\s*(million|billion|thousand|percent|people|users|companies)/i.test(f.content))
      .slice(0, 5)
      .map(f => {
        const stat = this.extractStatistic(f.content)
        return f.source ? `${stat} (Source: ${f.source}${f.year ? `, ${f.year}` : ''})` : stat
      })

    // Extract trends
    const trends = sortedFindings
      .filter(f => f.type === 'trend' || /trend|growing|increasing|rising|emerging|future/i.test(f.content))
      .slice(0, 4)
      .map(f => this.cleanFinding(f.content))

    // Extract notable quotes/facts
    const quotes = sortedFindings
      .filter(f => f.content.length > 50 && f.relevanceScore > 0.6)
      .slice(0, 3)
      .map(f => this.cleanFinding(f.content))

    // Generate citations
    const citations = sortedFindings
      .filter(f => f.source && f.sourceUrl)
      .slice(0, 5)
      .map(f => `${f.source}${f.year ? ` (${f.year})` : ''}: ${f.sourceUrl}`)

    // Create summary using AI
    let summary = ''
    if (sortedFindings.length > 0) {
      summary = await this.generateResearchSummary(
        sortedFindings.slice(0, 8),
        chapterTitle,
        bookNiche
      )
    } else {
      summary = `Research conducted for "${chapterTitle}" in "${bookTitle}" (${bookNiche}). Limited public data available - content will rely on established principles and frameworks.`
    }

    return {
      summary,
      statistics,
      trends,
      quotes,
      citations
    }
  }

  /**
   * Extract a clean statistic from text
   */
  private extractStatistic(text: string): string {
    // Try to find the most relevant sentence with a number
    const sentences = text.split(/[.!?]+/)
    const statSentence = sentences.find(s => /\d+%|\d+\s*(million|billion|thousand)/i.test(s))

    if (statSentence) {
      return statSentence.trim()
    }

    // Truncate if too long
    return text.length > 150 ? text.slice(0, 150) + '...' : text
  }

  /**
   * Clean a finding for presentation
   */
  private cleanFinding(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/^\s*[-•]\s*/, '')
      .trim()
      .slice(0, 200)
  }

  /**
   * Generate a summary of research findings using AI
   */
  private async generateResearchSummary(
    findings: ResearchFinding[],
    chapterTitle: string,
    bookNiche: string
  ): Promise<string> {
    const findingsText = findings
      .map(f => `- ${f.content}`)
      .join('\n')

    const prompt = `Summarize these research findings for a chapter titled "${chapterTitle}" in a ${bookNiche} book.

Research findings:
${findingsText}

Write a 2-3 sentence summary of the key insights that would be useful for writing this chapter. Focus on actionable data and trends.`

    try {
      const baseUrl = this.aiConfig.providerType === 'ollama'
        ? this.aiConfig.ollamaUrl
        : this.aiConfig.lmstudioUrl
      const model = this.aiConfig.providerType === 'ollama'
        ? this.aiConfig.ollamaModel
        : this.aiConfig.lmstudioModel

      const endpoint = this.aiConfig.providerType === 'ollama'
        ? `${baseUrl}/api/generate`
        : `${baseUrl}/v1/completions`

      const body = this.aiConfig.providerType === 'ollama'
        ? { model, prompt, stream: false }
        : { model, prompt, max_tokens: 200 }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        return data.response || data.choices?.[0]?.text || 'Research summary unavailable.'
      }
    } catch (error) {
      console.error('Failed to generate research summary:', error)
    }

    return `Research gathered ${findings.length} relevant findings about ${chapterTitle} including statistics, trends, and expert insights.`
  }

  /**
   * Format research for injection into writing prompts
   */
  formatForWritingPrompt(research: ChapterResearch): string {
    const sections: string[] = []

    sections.push('=== REAL-WORLD RESEARCH DATA ===')
    sections.push('Use this current research to enhance your writing with credible, up-to-date information:\n')

    if (research.summary) {
      sections.push(`RESEARCH OVERVIEW:\n${research.summary}\n`)
    }

    if (research.keyStatistics.length > 0) {
      sections.push('KEY STATISTICS (cite these in your writing):')
      research.keyStatistics.forEach(stat => sections.push(`• ${stat}`))
      sections.push('')
    }

    if (research.recentTrends.length > 0) {
      sections.push('CURRENT TRENDS:')
      research.recentTrends.forEach(trend => sections.push(`• ${trend}`))
      sections.push('')
    }

    if (research.notableQuotes.length > 0) {
      sections.push('NOTABLE INSIGHTS:')
      research.notableQuotes.forEach(quote => sections.push(`• ${quote}`))
      sections.push('')
    }

    sections.push('INTEGRATION GUIDELINES:')
    sections.push('- Naturally weave statistics into your narrative')
    sections.push('- Reference trends when discussing current state or future')
    sections.push('- Use "According to recent research..." or "Studies show..." for citations')
    sections.push('- Bold key statistics for emphasis')
    sections.push('=================================\n')

    return sections.join('\n')
  }

  /**
   * Quick research for a specific topic
   */
  async quickResearch(topic: string, niche: string): Promise<string[]> {
    const query = `${topic} ${niche} facts statistics ${new Date().getFullYear()}`
    const results = await this.performWebSearch(query)

    return results
      .filter(r => r.snippet.length > 30)
      .slice(0, 3)
      .map(r => r.snippet)
  }

  /**
   * Clear research cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cached research if available
   */
  getCachedResearch(bookTitle: string, chapterTitle: string): ChapterResearch | null {
    const cacheKey = `${bookTitle}-${chapterTitle}`.toLowerCase()
    return this.cache.get(cacheKey) || null
  }
}

interface SearchResult {
  title: string
  snippet: string
  url: string
  source: string
}

export const researchService = new ResearchService()
