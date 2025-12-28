/**
 * Performance Tracker - Measures and learns operation timing patterns
 * Tracks actual execution times to dynamically optimize timeouts
 */

export interface PerformanceMetric {
  model: string
  operationType: string  // 'section', 'question', 'answer', 'analysis'
  duration: number       // milliseconds
  timestamp: number
  success: boolean
  tokenCount?: number
}

export interface ModelPerformance {
  model: string
  avgDuration: number
  minDuration: number
  maxDuration: number
  successRate: number
  totalOperations: number
  recentAvg: number      // Average of last 10 operations
}

export class PerformanceTracker {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 500  // Keep last 500 metrics in memory

  /**
   * Record an operation's performance
   */
  recordOperation(
    model: string,
    operationType: string,
    duration: number,
    success: boolean,
    tokenCount?: number
  ): void {
    const metric: PerformanceMetric = {
      model,
      operationType,
      duration,
      timestamp: Date.now(),
      success,
      tokenCount
    }

    this.metrics.push(metric)

    // Keep memory bounded
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    console.log(
      `📊 Performance: ${model} ${operationType} - ${(duration / 1000).toFixed(1)}s ${success ? '✅' : '❌'}`
    )
  }

  /**
   * Get performance statistics for a specific model and operation type
   */
  getPerformanceStats(model: string, operationType: string): ModelPerformance | null {
    const relevantMetrics = this.metrics.filter(
      m => m.model === model && m.operationType === operationType
    )

    if (relevantMetrics.length === 0) {
      return null
    }

    const successfulMetrics = relevantMetrics.filter(m => m.success)
    const durations = successfulMetrics.map(m => m.duration)

    // Get recent metrics (last 10) for trend analysis
    const recentMetrics = relevantMetrics.slice(-10).filter(m => m.success)
    const recentDurations = recentMetrics.map(m => m.duration)

    return {
      model,
      avgDuration: this.average(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successfulMetrics.length / relevantMetrics.length,
      totalOperations: relevantMetrics.length,
      recentAvg: recentDurations.length > 0 ? this.average(recentDurations) : this.average(durations)
    }
  }

  /**
   * Get performance statistics for a model across all operation types
   */
  getModelPerformance(model: string): ModelPerformance | null {
    const relevantMetrics = this.metrics.filter(m => m.model === model)

    if (relevantMetrics.length === 0) {
      return null
    }

    const successfulMetrics = relevantMetrics.filter(m => m.success)
    const durations = successfulMetrics.map(m => m.duration)

    const recentMetrics = relevantMetrics.slice(-20).filter(m => m.success)
    const recentDurations = recentMetrics.map(m => m.duration)

    return {
      model,
      avgDuration: this.average(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successfulMetrics.length / relevantMetrics.length,
      totalOperations: relevantMetrics.length,
      recentAvg: recentDurations.length > 0 ? this.average(recentDurations) : this.average(durations)
    }
  }

  /**
   * Calculate recommended timeout based on performance history
   */
  getRecommendedTimeout(model: string, operationType: string): number {
    const stats = this.getPerformanceStats(model, operationType)

    if (!stats || stats.totalOperations < 3) {
      // Not enough data - use conservative defaults
      return this.getDefaultTimeout(operationType)
    }

    // Use recent average for trend-sensitive timeout
    // Add buffer: 2.5x recent average (allows for variance)
    // Minimum buffer: +60s from max observed
    const trendBasedTimeout = stats.recentAvg * 2.5
    const maxBasedTimeout = stats.maxDuration + 60000

    // Use the larger of the two for safety
    const recommendedTimeout = Math.max(trendBasedTimeout, maxBasedTimeout)

    // Apply reasonable bounds
    const minTimeout = 60000   // 1 minute minimum
    const maxTimeout = 900000  // 15 minutes maximum

    return Math.max(minTimeout, Math.min(maxTimeout, recommendedTimeout))
  }

  /**
   * Get default timeout for operation type when no data available
   */
  private getDefaultTimeout(operationType: string): number {
    const defaults: Record<string, number> = {
      'section': 240000,      // 4 minutes
      'question': 180000,     // 3 minutes
      'answer': 180000,       // 3 minutes
      'analysis': 120000,     // 2 minutes
      'redraft': 300000       // 5 minutes
    }

    return defaults[operationType] || 240000
  }

  /**
   * Detect if performance is degrading (trend analysis)
   */
  isPerformanceDegrading(model: string): boolean {
    const stats = this.getModelPerformance(model)

    if (!stats || stats.totalOperations < 10) {
      return false
    }

    // If recent average is >50% slower than overall average, performance is degrading
    return stats.recentAvg > stats.avgDuration * 1.5
  }

  /**
   * Get human-readable performance report
   */
  getPerformanceReport(model: string): string {
    const stats = this.getModelPerformance(model)

    if (!stats) {
      return `No performance data for ${model}`
    }

    const lines = [
      `📊 Performance Report: ${model}`,
      `   Operations: ${stats.totalOperations}`,
      `   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`,
      `   Avg Duration: ${(stats.avgDuration / 1000).toFixed(1)}s`,
      `   Recent Avg: ${(stats.recentAvg / 1000).toFixed(1)}s`,
      `   Range: ${(stats.minDuration / 1000).toFixed(1)}s - ${(stats.maxDuration / 1000).toFixed(1)}s`
    ]

    if (this.isPerformanceDegrading(model)) {
      lines.push(`   ⚠️ Warning: Performance degrading (recent ops slower)`)
    }

    return lines.join('\n')
  }

  /**
   * Clear old metrics (older than specified days)
   */
  clearOldMetrics(daysToKeep: number = 7): void {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    const before = this.metrics.length
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime)
    const removed = before - this.metrics.length

    if (removed > 0) {
      console.log(`🧹 Cleared ${removed} old performance metrics`)
    }
  }

  /**
   * Export metrics for persistence
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Import metrics from persistence
   */
  importMetrics(metrics: PerformanceMetric[]): void {
    this.metrics = metrics.slice(-this.maxMetrics)
    console.log(`📥 Imported ${this.metrics.length} performance metrics`)
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
  }
}
