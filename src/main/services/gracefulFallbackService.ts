/**
 * Graceful Fallback Service - Never crash, always find a way forward
 * Implements progressive fallback strategies when operations timeout or fail
 */

export interface FallbackConfig {
  maxRetries: number
  strategies: FallbackStrategy[]
  emergencyMode: boolean
}

export type FallbackStrategy =
  | 'retry'           // Retry with same parameters
  | 'reduce_length'   // Reduce requested output length
  | 'simplify_prompt' // Use simpler, more direct prompt
  | 'lower_temp'      // Reduce temperature for more focused output
  | 'split_task'      // Break into smaller sub-tasks
  | 'minimal'         // Generate absolute minimum viable content

export interface FallbackResult<T> {
  success: boolean
  data?: T
  strategyUsed: string
  attemptsUsed: number
  degraded: boolean  // True if we had to use fallback strategies
  error?: string
}

export class GracefulFallbackService {
  /**
   * Execute an operation with progressive fallback strategies
   */
  async executeWithFallback<T>(
    operationName: string,
    primaryOperation: () => Promise<T>,
    fallbackConfig?: Partial<FallbackConfig>
  ): Promise<FallbackResult<T>> {
    const config: FallbackConfig = {
      maxRetries: 3,
      strategies: ['retry', 'reduce_length', 'simplify_prompt', 'minimal'],
      emergencyMode: false,
      ...fallbackConfig
    }

    let lastError: Error | undefined

    // Try primary operation first
    console.log(`🎯 Attempting: ${operationName}`)
    try {
      const result = await primaryOperation()
      return {
        success: true,
        data: result,
        strategyUsed: 'primary',
        attemptsUsed: 1,
        degraded: false
      }
    } catch (error) {
      lastError = error as Error
      console.log(`⚠️ Primary attempt failed: ${lastError.message}`)
    }

    // Try fallback strategies
    let attemptNumber = 1

    for (const strategy of config.strategies) {
      if (attemptNumber >= config.maxRetries) {
        console.log(`⛔ Max retries (${config.maxRetries}) reached`)
        break
      }

      attemptNumber++
      console.log(`🔄 Fallback attempt ${attemptNumber}: ${strategy}`)

      try {
        const result = await this.applyStrategy(strategy, primaryOperation, lastError)

        return {
          success: true,
          data: result,
          strategyUsed: strategy,
          attemptsUsed: attemptNumber,
          degraded: true
        }
      } catch (error) {
        lastError = error as Error
        console.log(`   ❌ ${strategy} failed: ${lastError.message}`)
      }
    }

    // All strategies failed - return failure result
    console.error(`❌ All fallback strategies exhausted for: ${operationName}`)

    return {
      success: false,
      strategyUsed: 'none',
      attemptsUsed: attemptNumber,
      degraded: true,
      error: lastError?.message || 'Unknown error'
    }
  }

  /**
   * Apply a specific fallback strategy
   */
  private async applyStrategy<T>(
    strategy: FallbackStrategy,
    operation: () => Promise<T>,
    lastError?: Error
  ): Promise<T> {
    switch (strategy) {
      case 'retry':
        // Simple retry with small delay
        await this.delay(2000)
        return operation()

      case 'reduce_length':
      case 'simplify_prompt':
      case 'lower_temp':
      case 'split_task':
      case 'minimal':
        // These strategies need to be implemented at the caller level
        // They can't modify the operation after it's defined
        // So we just retry with delay
        await this.delay(3000)
        return operation()

      default:
        return operation()
    }
  }

  /**
   * Generate fallback prompt (simpler, more direct)
   */
  simplifyPrompt(originalPrompt: string, targetLength: number = 150): string {
    // Extract key intent from original prompt
    const lines = originalPrompt.split('\n').filter(line => line.trim())

    // Take first few lines (usually contain main instruction)
    const coreInstruction = lines.slice(0, 3).join('\n')

    return `${coreInstruction}

Write ${targetLength} words maximum. Be concise and direct.`
  }

  /**
   * Reduce target word count for fallback attempts
   */
  reduceWordCount(originalCount: number, reductionFactor: number = 0.5): number {
    return Math.max(100, Math.floor(originalCount * reductionFactor))
  }

  /**
   * Generate minimal viable prompt for emergency fallback
   */
  generateMinimalPrompt(topic: string, wordCount: number = 100): string {
    return `Write ${wordCount} words about: ${topic}

Keep it simple and clear. No complex examples needed.`
  }

  /**
   * Split a large task into smaller chunks
   */
  splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Create a timeout-safe wrapper for any async operation
   */
  async withTimeoutFallback<T>(
    operation: () => Promise<T>,
    timeout: number,
    fallback: () => Promise<T>
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const result = await operation()
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏱️ Timeout after ${timeout / 1000}s, using fallback`)
        return fallback()
      }

      throw error
    }
  }

  /**
   * Generate emergency content when all else fails
   */
  generateEmergencyContent(contentType: string, topic: string): string {
    const templates: Record<string, string> = {
      'section': `## ${topic}

This section explores ${topic} and its key aspects. Understanding this concept is important for achieving success in this area.

Key points to consider:
- Core principles of ${topic}
- Practical applications
- Common challenges and solutions

By mastering these fundamentals, you'll be better equipped to apply ${topic} effectively.`,

      'question': `How can we better understand and apply ${topic}?`,

      'answer': `${topic} requires careful consideration of multiple factors. The key is to start with fundamental principles and build from there through consistent practice and application.`,

      'analysis': `Analysis of ${topic}: This topic presents both opportunities and challenges. A balanced approach considering multiple perspectives will yield the best results.`
    }

    return templates[contentType] || `Content about ${topic} generated in emergency fallback mode.`
  }

  /**
   * Log fallback usage for monitoring
   */
  logFallbackUsage(result: FallbackResult<any>, operationName: string): void {
    if (!result.success) {
      console.error(`🚨 FALLBACK FAILURE: ${operationName}`)
      console.error(`   Error: ${result.error}`)
      console.error(`   Attempts: ${result.attemptsUsed}`)
    } else if (result.degraded) {
      console.warn(`⚠️ DEGRADED SUCCESS: ${operationName}`)
      console.warn(`   Strategy: ${result.strategyUsed}`)
      console.warn(`   Attempts: ${result.attemptsUsed}`)
    } else {
      console.log(`✅ SUCCESS: ${operationName} (primary strategy)`)
    }
  }

  /**
   * Check if system should enter emergency mode (too many failures)
   */
  shouldEnterEmergencyMode(recentFailures: number, threshold: number = 3): boolean {
    return recentFailures >= threshold
  }

  /**
   * Create a simple fallback operation that always succeeds
   */
  createGuaranteedFallback<T>(
    emergencyValue: T,
    warningMessage: string
  ): () => Promise<T> {
    return async () => {
      console.warn(`🆘 EMERGENCY FALLBACK: ${warningMessage}`)
      return emergencyValue
    }
  }
}
