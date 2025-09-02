# Day 34: 性能监控和优化

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 配置 Cloudflare Analytics
- [ ] 监控 API 响应时间和错误率
- [ ] 优化慢查询和性能瓶颈
- [ ] 设置用户体验监控

## 📚 学习笔记

### 全栈性能监控体系

#### 性能监控金字塔

```
                    用户体验监控
                 ┌─────────────────┐
                 │  Core Web Vitals │
                 │  Real User       │
                 │  Monitoring      │
                 └─────────────────┘
               ┌─────────────────────┐
               │   应用性能监控       │
               │   API响应时间       │
               │   错误率统计         │
               │   业务指标追踪       │
               └─────────────────────┘
            ┌─────────────────────────┐
            │      基础设施监控        │
            │   Workers CPU/内存      │
            │   D1 数据库性能         │
            │   网络延迟统计          │
            └─────────────────────────┘
```

**监控层次划分**：

1. **用户体验监控**：关注真实用户感受的性能指标
2. **应用性能监控**：追踪 API 和业务逻辑性能
3. **基础设施监控**：监控底层资源使用情况

#### Cloudflare Analytics 深度集成

```typescript
// src/utils/analytics-engine.ts
export interface PerformanceMetrics {
  // 请求基础信息
  timestamp: number
  requestId: string
  endpoint: string
  method: string
  status: number

  // 性能指标
  duration: number
  dbQueryTime: number
  computeTime: number
  networkTime: number

  // 用户相关
  userId?: string
  userAgent: string
  country: string
  colo: string // Cloudflare 数据中心

  // 业务指标
  feature?: string
  businessMetric?: number
  errorCode?: string
  stackTrace?: string
}

export class CloudflareAnalyticsEngine {
  private dataset: string
  private batchSize = 100
  private batchTimeout = 5000 // 5秒
  private metricsBuffer: PerformanceMetrics[] = []
  private flushTimer?: NodeJS.Timeout

  constructor(dataset: string) {
    this.dataset = dataset
  }

  async track(metrics: PerformanceMetrics, env: any) {
    // 添加到批处理缓冲区
    this.metricsBuffer.push({
      ...metrics,
      timestamp: Date.now(),
    })

    // 达到批次大小时立即发送
    if (this.metricsBuffer.length >= this.batchSize) {
      await this.flush(env)
    } else if (!this.flushTimer) {
      // 设置定时器确保数据不会在缓冲区中停留太久
      this.flushTimer = setTimeout(() => this.flush(env), this.batchTimeout)
    }
  }

  private async flush(env: any) {
    if (this.metricsBuffer.length === 0) return

    const batch = [...this.metricsBuffer]
    this.metricsBuffer = []

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }

    try {
      if (env.ANALYTICS_ENGINE) {
        await Promise.all(
          batch.map(metrics =>
            env.ANALYTICS_ENGINE.writeDataPoint({
              blobs: [
                metrics.requestId,
                metrics.endpoint,
                metrics.method,
                metrics.userAgent,
                metrics.country,
                metrics.colo,
                metrics.feature || 'unknown',
                metrics.errorCode || '',
              ],
              doubles: [
                metrics.timestamp,
                metrics.status,
                metrics.duration,
                metrics.dbQueryTime,
                metrics.computeTime,
                metrics.networkTime,
                metrics.businessMetric || 0,
              ],
              indexes: [
                metrics.endpoint,
                metrics.status.toString(),
                metrics.country,
                metrics.feature || 'unknown',
              ],
            }),
          ),
        )
      }

      // 同时发送到多个监控平台
      await this.sendToExternalMonitoring(batch)
    } catch (error) {
      console.error('Failed to flush analytics data:', error)
      // 失败的数据重新加入缓冲区（避免数据丢失）
      this.metricsBuffer.unshift(...batch)
    }
  }

  private async sendToExternalMonitoring(metrics: PerformanceMetrics[]) {
    // 发送到其他监控平台（如 Datadog、New Relic 等）
    const summaryData = this.aggregateMetrics(metrics)

    await Promise.allSettled([
      this.sendToDatadog(summaryData),
      this.sendToSlack(this.detectAnomalies(summaryData)),
      this.updateHealthStatus(summaryData),
    ])
  }

  private aggregateMetrics(metrics: PerformanceMetrics[]) {
    const grouped = metrics.reduce(
      (acc, metric) => {
        const key = `${metric.endpoint}:${metric.method}`
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(metric)
        return acc
      },
      {} as Record<string, PerformanceMetrics[]>,
    )

    return Object.entries(grouped).map(([endpoint, endpointMetrics]) => ({
      endpoint,
      count: endpointMetrics.length,
      avgDuration:
        endpointMetrics.reduce((sum, m) => sum + m.duration, 0) /
        endpointMetrics.length,
      avgDbTime:
        endpointMetrics.reduce((sum, m) => sum + m.dbQueryTime, 0) /
        endpointMetrics.length,
      errorRate:
        endpointMetrics.filter(m => m.status >= 400).length /
        endpointMetrics.length,
      p95Duration: this.calculatePercentile(
        endpointMetrics.map(m => m.duration),
        95,
      ),
      p99Duration: this.calculatePercentile(
        endpointMetrics.map(m => m.duration),
        99,
      ),
      topCountries: this.getTopCountries(endpointMetrics),
      timeRange: {
        start: Math.min(...endpointMetrics.map(m => m.timestamp)),
        end: Math.max(...endpointMetrics.map(m => m.timestamp)),
      },
    }))
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  private getTopCountries(
    metrics: PerformanceMetrics[],
  ): Record<string, number> {
    return metrics.reduce(
      (acc, m) => {
        acc[m.country] = (acc[m.country] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }

  private detectAnomalies(summaryData: any[]): any[] {
    return summaryData.filter(data => {
      return (
        data.avgDuration > 2000 || // 平均响应时间超过2秒
        data.errorRate > 0.05 || // 错误率超过5%
        data.p99Duration > 10000 // 99分位响应时间超过10秒
      )
    })
  }

  private async sendToDatadog(summaryData: any[]) {
    // 发送到 Datadog 的实现
    const datadogMetrics = summaryData.map(data => ({
      metric: 'vue_blog.api.performance',
      points: [[Date.now() / 1000, data.avgDuration]],
      tags: [`endpoint:${data.endpoint}`],
      type: 'gauge',
    }))

    // 实际的 HTTP 请求发送逻辑
  }

  private async sendToSlack(anomalies: any[]) {
    if (anomalies.length === 0) return

    const message = {
      text: `⚠️ 检测到 ${anomalies.length} 个性能异常`,
      blocks: anomalies.map(anomaly => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${anomaly.endpoint}*\n平均响应时间: ${anomaly.avgDuration}ms\n错误率: ${(anomaly.errorRate * 100).toFixed(2)}%`,
        },
      })),
    }

    // 发送到 Slack webhook
  }

  private async updateHealthStatus(summaryData: any[]) {
    const overallHealth = this.calculateOverallHealth(summaryData)

    // 更新健康状态到 KV 存储
    // await env.HEALTH_STATUS.put('overall_health', JSON.stringify(overallHealth))
  }

  private calculateOverallHealth(summaryData: any[]): {
    status: string
    score: number
    issues: string[]
  } {
    let score = 100
    const issues: string[] = []

    for (const data of summaryData) {
      if (data.avgDuration > 1000) {
        score -= 10
        issues.push(`${data.endpoint} 响应时间过长`)
      }
      if (data.errorRate > 0.01) {
        score -= 20
        issues.push(`${data.endpoint} 错误率偏高`)
      }
    }

    const status =
      score > 90 ? 'healthy' : score > 70 ? 'degraded' : 'unhealthy'
    return { status, score, issues }
  }
}

// 全局分析引擎实例
export const analyticsEngine = new CloudflareAnalyticsEngine('vue_blog_metrics')
```

#### 高级性能中间件

```typescript
// src/middleware/performance-advanced.ts
import { Context, Next } from 'hono'
import { analyticsEngine } from '../utils/analytics-engine'

export interface RequestContext extends Context {
  startTime: number
  metrics: {
    dbQueries: Array<{
      sql: string
      duration: number
      rowsAffected: number
    }>
    cacheHits: number
    cacheMisses: number
    computeOperations: Array<{
      operation: string
      duration: number
    }>
  }
}

export const advancedPerformanceMiddleware = async (c: Context, next: Next) => {
  const startTime = performance.now()
  const requestId = c.req.header('cf-ray') || generateRequestId()

  // 增强上下文，添加性能监控能力
  const enhancedContext = c as RequestContext
  enhancedContext.startTime = startTime
  enhancedContext.metrics = {
    dbQueries: [],
    cacheHits: 0,
    cacheMisses: 0,
    computeOperations: [],
  }

  // 包装数据库对象以监控查询性能
  if (c.env.DB) {
    c.env.DB = createDBProxy(c.env.DB, enhancedContext.metrics)
  }

  // 包装缓存对象以监控缓存性能
  if (c.env.KV_CACHE) {
    c.env.KV_CACHE = createCacheProxy(c.env.KV_CACHE, enhancedContext.metrics)
  }

  // 添加计算性能监控函数
  enhancedContext.measureCompute = (operation: string, fn: () => any) => {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start

    enhancedContext.metrics.computeOperations.push({
      operation,
      duration,
    })

    return result
  }

  let error: any = null

  try {
    await next()
  } catch (err) {
    error = err
    throw err
  } finally {
    const totalDuration = performance.now() - startTime

    // 计算各部分耗时
    const dbQueryTime = enhancedContext.metrics.dbQueries.reduce(
      (sum, query) => sum + query.duration,
      0,
    )
    const computeTime = enhancedContext.metrics.computeOperations.reduce(
      (sum, op) => sum + op.duration,
      0,
    )
    const networkTime = totalDuration - dbQueryTime - computeTime

    // 收集完整的性能指标
    const metrics = {
      requestId,
      endpoint: new URL(c.req.url).pathname,
      method: c.req.method,
      status: c.res.status,
      duration: totalDuration,
      dbQueryTime,
      computeTime,
      networkTime,
      userAgent: c.req.header('user-agent') || 'unknown',
      country: c.req.header('cf-ipcountry') || 'unknown',
      colo: c.req.header('cf-colo') || 'unknown',

      // 详细指标
      dbQueryCount: enhancedContext.metrics.dbQueries.length,
      cacheHitRate:
        enhancedContext.metrics.cacheHits /
        (enhancedContext.metrics.cacheHits +
          enhancedContext.metrics.cacheMisses),

      // 错误信息
      errorCode: error?.code,
      errorMessage: error?.message,
    }

    // 异步发送监控数据
    c.executionCtx?.waitUntil(analyticsEngine.track(metrics, c.env))

    // 设置响应头
    c.header('X-Request-ID', requestId)
    c.header('X-Response-Time', `${totalDuration.toFixed(2)}ms`)
    c.header('X-DB-Query-Time', `${dbQueryTime.toFixed(2)}ms`)
    c.header('X-Cache-Hit-Rate', `${(metrics.cacheHitRate * 100).toFixed(1)}%`)

    // 性能预警
    if (totalDuration > 5000) {
      console.warn(
        `Slow request detected: ${c.req.method} ${c.req.url} took ${totalDuration}ms`,
      )
    }

    if (metrics.cacheHitRate < 0.8) {
      console.warn(
        `Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}% for ${c.req.url}`,
      )
    }
  }
}

function createDBProxy(
  originalDB: D1Database,
  metrics: RequestContext['metrics'],
) {
  return new Proxy(originalDB, {
    get(target, prop) {
      if (prop === 'prepare') {
        return (sql: string) => {
          const statement = target.prepare(sql)
          return new Proxy(statement, {
            get(stmtTarget, stmtProp) {
              if (['first', 'all', 'run'].includes(stmtProp as string)) {
                return async (...args: any[]) => {
                  const queryStart = performance.now()
                  const result = await stmtTarget[
                    stmtProp as keyof typeof stmtTarget
                  ](...args)
                  const queryDuration = performance.now() - queryStart

                  metrics.dbQueries.push({
                    sql:
                      sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                    duration: queryDuration,
                    rowsAffected: result?.meta?.changes || 0,
                  })

                  return result
                }
              }
              return stmtTarget[stmtProp as keyof typeof stmtTarget]
            },
          })
        }
      }
      return target[prop as keyof typeof target]
    },
  })
}

function createCacheProxy(
  originalKV: KVNamespace,
  metrics: RequestContext['metrics'],
) {
  return new Proxy(originalKV, {
    get(target, prop) {
      if (prop === 'get') {
        return async (key: string, options?: any) => {
          const result = await target.get(key, options)
          if (result !== null) {
            metrics.cacheHits++
          } else {
            metrics.cacheMisses++
          }
          return result
        }
      }
      return target[prop as keyof typeof target]
    },
  })
}

function generateRequestId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}
```

### 数据库性能优化

#### 智能索引优化器

```typescript
// src/utils/database-optimizer.ts
export interface QueryAnalysis {
  sql: string
  executionTime: number
  rowsExamined: number
  rowsReturned: number
  useIndex: boolean
  suggestedIndexes: string[]
  optimizationScore: number
}

export class DatabaseOptimizer {
  private queryHistory: Map<string, QueryAnalysis[]> = new Map()
  private slowQueryThreshold = 100 // 100ms

  async analyzeQuery(
    db: D1Database,
    sql: string,
    params: any[],
  ): Promise<QueryAnalysis> {
    const start = performance.now()

    // 执行查询计划分析
    const explainResult = await db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .bind(...params)
      .all()

    // 执行实际查询
    const actualResult = await db
      .prepare(sql)
      .bind(...params)
      .all()

    const executionTime = performance.now() - start

    // 分析查询计划
    const analysis = this.parseExplainResult(explainResult.results)

    const queryAnalysis: QueryAnalysis = {
      sql,
      executionTime,
      rowsExamined: analysis.rowsExamined,
      rowsReturned: actualResult.results.length,
      useIndex: analysis.useIndex,
      suggestedIndexes: this.suggestIndexes(sql, analysis),
      optimizationScore: this.calculateOptimizationScore(
        analysis,
        executionTime,
      ),
    }

    // 记录查询历史
    const normalizedSQL = this.normalizeSQL(sql)
    if (!this.queryHistory.has(normalizedSQL)) {
      this.queryHistory.set(normalizedSQL, [])
    }
    this.queryHistory.get(normalizedSQL)!.push(queryAnalysis)

    return queryAnalysis
  }

  private parseExplainResult(explainResults: any[]): {
    rowsExamined: number
    useIndex: boolean
    scanType: string
  } {
    let rowsExamined = 0
    let useIndex = false
    let scanType = 'UNKNOWN'

    for (const row of explainResults) {
      const detail = row.detail || ''

      // 检查是否使用索引
      if (
        detail.includes('USING INDEX') ||
        detail.includes('USING COVERING INDEX')
      ) {
        useIndex = true
      }

      // 估算扫描行数
      if (detail.includes('SCAN')) {
        if (detail.includes('TABLE')) {
          scanType = 'FULL_TABLE_SCAN'
          rowsExamined = 10000 // 估算值
        } else if (detail.includes('INDEX')) {
          scanType = 'INDEX_SCAN'
          rowsExamined = 100 // 估算值
        }
      }
    }

    return { rowsExamined, useIndex, scanType }
  }

  private suggestIndexes(sql: string, analysis: any): string[] {
    const suggestions: string[] = []

    // 简化的索引建议逻辑
    const whereMatch = sql.match(
      /WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/i,
    )
    if (whereMatch) {
      const whereClause = whereMatch[1]

      // 检查等值查询列
      const equalityColumns = whereClause.match(/(\w+)\s*=\s*/g)
      if (equalityColumns) {
        equalityColumns.forEach(col => {
          const columnName = col.replace(/\s*=\s*$/, '')
          suggestions.push(
            `CREATE INDEX IF NOT EXISTS idx_${columnName} ON table_name (${columnName})`,
          )
        })
      }

      // 检查范围查询列
      const rangeColumns = whereClause.match(/(\w+)\s*[<>]/g)
      if (rangeColumns) {
        rangeColumns.forEach(col => {
          const columnName = col.replace(/\s*[<>].*$/, '')
          suggestions.push(
            `CREATE INDEX IF NOT EXISTS idx_${columnName}_range ON table_name (${columnName})`,
          )
        })
      }
    }

    // 检查 ORDER BY 列
    const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/i)
    if (orderMatch) {
      const orderColumn = orderMatch[1].split(',')[0].trim()
      suggestions.push(
        `CREATE INDEX IF NOT EXISTS idx_${orderColumn}_sort ON table_name (${orderColumn})`,
      )
    }

    return suggestions
  }

  private calculateOptimizationScore(
    analysis: any,
    executionTime: number,
  ): number {
    let score = 100

    // 执行时间扣分
    if (executionTime > this.slowQueryThreshold) {
      score -= Math.min(50, (executionTime - this.slowQueryThreshold) / 10)
    }

    // 未使用索引扣分
    if (!analysis.useIndex) {
      score -= 30
    }

    // 扫描行数过多扣分
    if (analysis.rowsExamined > 1000) {
      score -= 20
    }

    return Math.max(0, score)
  }

  private normalizeSQL(sql: string): string {
    // 标准化 SQL 以便分组相似查询
    return sql
      .replace(/\s+/g, ' ') // 压缩空格
      .replace(/=\s*[?$]\d*/g, '= ?') // 标准化参数占位符
      .replace(/IN\s*\([^)]+\)/gi, 'IN (?)') // 标准化 IN 子句
      .toLowerCase()
      .trim()
  }

  async generateOptimizationReport(): Promise<{
    slowQueries: QueryAnalysis[]
    indexSuggestions: string[]
    performanceTrends: any[]
  }> {
    const slowQueries: QueryAnalysis[] = []
    const allIndexSuggestions = new Set<string>()
    const performanceTrends: any[] = []

    // 分析所有查询历史
    for (const [normalizedSQL, queries] of this.queryHistory.entries()) {
      const recentQueries = queries.slice(-10) // 最近10次查询
      const avgExecutionTime =
        recentQueries.reduce((sum, q) => sum + q.executionTime, 0) /
        recentQueries.length

      if (avgExecutionTime > this.slowQueryThreshold) {
        const worstQuery = recentQueries.sort(
          (a, b) => b.executionTime - a.executionTime,
        )[0]
        slowQueries.push(worstQuery)

        // 收集索引建议
        worstQuery.suggestedIndexes.forEach(idx => allIndexSuggestions.add(idx))
      }

      // 生成性能趋势数据
      if (queries.length >= 5) {
        const trend = this.calculatePerformanceTrend(queries)
        performanceTrends.push({
          sql: normalizedSQL,
          trend,
          currentAvg: avgExecutionTime,
          queryCount: queries.length,
        })
      }
    }

    return {
      slowQueries: slowQueries.sort(
        (a, b) => b.executionTime - a.executionTime,
      ),
      indexSuggestions: Array.from(allIndexSuggestions),
      performanceTrends,
    }
  }

  private calculatePerformanceTrend(
    queries: QueryAnalysis[],
  ): 'improving' | 'degrading' | 'stable' {
    if (queries.length < 5) return 'stable'

    const recentHalf = queries.slice(-Math.floor(queries.length / 2))
    const earlierHalf = queries.slice(0, Math.floor(queries.length / 2))

    const recentAvg =
      recentHalf.reduce((sum, q) => sum + q.executionTime, 0) /
      recentHalf.length
    const earlierAvg =
      earlierHalf.reduce((sum, q) => sum + q.executionTime, 0) /
      earlierHalf.length

    const changePercent = (recentAvg - earlierAvg) / earlierAvg

    if (changePercent > 0.2) return 'degrading'
    if (changePercent < -0.2) return 'improving'
    return 'stable'
  }
}

// 全局优化器实例
export const dbOptimizer = new DatabaseOptimizer()
```

#### 自动化缓存预热系统

```typescript
// src/utils/cache-warmer.ts
export interface CacheWarmupRule {
  key: string
  generator: () => Promise<any>
  ttl: number
  refreshInterval: number
  dependencies: string[]
  priority: 'high' | 'medium' | 'low'
}

export class CacheWarmer {
  private rules: Map<string, CacheWarmupRule> = new Map()
  private warmupInProgress = new Set<string>()

  registerRule(rule: CacheWarmupRule) {
    this.rules.set(rule.key, rule)
  }

  async warmupCache(
    env: any,
    keys?: string[],
  ): Promise<{
    success: string[]
    failed: string[]
    skipped: string[]
  }> {
    const success: string[] = []
    const failed: string[] = []
    const skipped: string[] = []

    const rulesToWarmup = keys
      ? keys.map(key => this.rules.get(key)).filter(Boolean)
      : Array.from(this.rules.values())

    // 按优先级排序
    const sortedRules = rulesToWarmup.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b!.priority] - priorityOrder[a!.priority]
    })

    // 并发执行（限制并发数）
    const concurrencyLimit = 5
    const chunks = this.chunkArray(sortedRules, concurrencyLimit)

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async rule => {
          if (!rule) return

          try {
            if (this.warmupInProgress.has(rule.key)) {
              skipped.push(rule.key)
              return
            }

            this.warmupInProgress.add(rule.key)

            // 检查依赖
            const dependenciesMet = await this.checkDependencies(
              rule.dependencies,
              env,
            )
            if (!dependenciesMet) {
              skipped.push(rule.key)
              return
            }

            // 生成缓存数据
            const data = await rule.generator()

            // 存储到缓存
            await env.KV_CACHE.put(rule.key, JSON.stringify(data), {
              expirationTtl: rule.ttl,
            })

            success.push(rule.key)
          } catch (error) {
            console.error(`Cache warmup failed for ${rule.key}:`, error)
            failed.push(rule.key)
          } finally {
            this.warmupInProgress.delete(rule.key)
          }
        }),
      )
    }

    return { success, failed, skipped }
  }

  private async checkDependencies(
    dependencies: string[],
    env: any,
  ): Promise<boolean> {
    if (dependencies.length === 0) return true

    const dependencyChecks = await Promise.all(
      dependencies.map(async dep => {
        const value = await env.KV_CACHE.get(dep)
        return value !== null
      }),
    )

    return dependencyChecks.every(Boolean)
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  async schedulePeriodicWarmup(env: any) {
    // 这个函数会被 Cron 触发器调用
    console.log('Starting periodic cache warmup...')

    const result = await this.warmupCache(env)

    console.log(`Cache warmup completed:`, {
      success: result.success.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
    })

    // 发送通知到监控系统
    if (result.failed.length > 0) {
      await this.notifyWarmupFailures(result.failed, env)
    }

    return result
  }

  private async notifyWarmupFailures(failedKeys: string[], env: any) {
    const message = {
      text: '⚠️ 缓存预热部分失败',
      details: {
        failedKeys,
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'unknown',
      },
    }

    // 发送到监控系统
    await Promise.allSettled([
      this.sendToSlack(message),
      this.recordToAnalytics(message, env),
    ])
  }

  private async sendToSlack(message: any) {
    // Slack 通知实现
  }

  private async recordToAnalytics(message: any, env: any) {
    // 记录到分析系统
  }
}

// 预定义的缓存预热规则
export const setupCacheWarmupRules = (warmer: CacheWarmer, db: D1Database) => {
  // 热门文章列表
  warmer.registerRule({
    key: 'popular_articles',
    generator: async () => {
      const result = await db
        .prepare(
          `
        SELECT id, title, summary, view_count, like_count
        FROM articles 
        WHERE status = 'published'
        ORDER BY view_count DESC, like_count DESC
        LIMIT 20
      `,
        )
        .all()
      return result.results
    },
    ttl: 3600, // 1小时
    refreshInterval: 1800, // 30分钟刷新一次
    dependencies: [],
    priority: 'high',
  })

  // 用户统计信息
  warmer.registerRule({
    key: 'user_stats',
    generator: async () => {
      const [totalUsers, activeUsers, newUsers] = await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM users').first(),
        db
          .prepare(
            `
          SELECT COUNT(*) as count FROM users 
          WHERE updated_at > datetime('now', '-7 days')
        `,
          )
          .first(),
        db
          .prepare(
            `
          SELECT COUNT(*) as count FROM users 
          WHERE created_at > datetime('now', '-24 hours')
        `,
          )
          .first(),
      ])

      return {
        totalUsers: totalUsers.count,
        activeUsers: activeUsers.count,
        newUsers: newUsers.count,
        updatedAt: new Date().toISOString(),
      }
    },
    ttl: 1800, // 30分钟
    refreshInterval: 900, // 15分钟刷新一次
    dependencies: [],
    priority: 'medium',
  })

  // 标签云数据
  warmer.registerRule({
    key: 'tag_cloud',
    generator: async () => {
      const result = await db
        .prepare(
          `
        SELECT tag, COUNT(*) as count
        FROM article_tags at
        JOIN articles a ON at.article_id = a.id
        WHERE a.status = 'published'
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 50
      `,
        )
        .all()
      return result.results
    },
    ttl: 7200, // 2小时
    refreshInterval: 3600, // 1小时刷新一次
    dependencies: [],
    priority: 'low',
  })
}

// 全局缓存预热器
export const cacheWarmer = new CacheWarmer()
```

### 前端性能监控

#### Core Web Vitals 监控

```typescript
// src/utils/web-vitals-monitor.ts
export interface WebVitalsMetrics {
  // Core Web Vitals
  CLS: number // Cumulative Layout Shift
  FID: number // First Input Delay
  LCP: number // Largest Contentful Paint

  // 其他重要指标
  FCP: number // First Contentful Paint
  TTFB: number // Time to First Byte
  INP: number // Interaction to Next Paint

  // 自定义指标
  routeChangeTime: number
  apiResponseTime: number
  renderTime: number

  // 上下文信息
  url: string
  userAgent: string
  connectionType: string
  deviceMemory: number
  hardwareConcurrency: number
  timestamp: number
}

export class WebVitalsMonitor {
  private metrics: Partial<WebVitalsMetrics> = {}
  private observers: PerformanceObserver[] = []
  private reportEndpoint = '/api/analytics/web-vitals'
  private batchSize = 10
  private batchTimeout = 5000
  private metricsBuffer: WebVitalsMetrics[] = []
  private flushTimer?: number

  constructor() {
    this.initializeObservers()
    this.setupUnloadHandler()
  }

  private initializeObservers() {
    // 监控 LCP
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceEntry
        this.metrics.LCP = lastEntry.startTime
        this.scheduleReport()
      })

      try {
        lcpObserver.observe({
          type: 'largest-contentful-paint',
          buffered: true,
        })
        this.observers.push(lcpObserver)
      } catch (e) {
        console.warn('LCP observer not supported')
      }
    }

    // 监控 FID
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries()
        entries.forEach((entry: any) => {
          this.metrics.FID = entry.processingStart - entry.startTime
          this.scheduleReport()
        })
      })

      try {
        fidObserver.observe({ type: 'first-input', buffered: true })
        this.observers.push(fidObserver)
      } catch (e) {
        console.warn('FID observer not supported')
      }
    }

    // 监控 CLS
    if ('PerformanceObserver' in window) {
      let clsValue = 0
      const clsObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries()
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        this.metrics.CLS = clsValue
        this.scheduleReport()
      })

      try {
        clsObserver.observe({ type: 'layout-shift', buffered: true })
        this.observers.push(clsObserver)
      } catch (e) {
        console.warn('CLS observer not supported')
      }
    }

    // 监控 FCP
    if ('PerformanceObserver' in window) {
      const fcpObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries()
        entries.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.FCP = entry.startTime
            this.scheduleReport()
          }
        })
      })

      try {
        fcpObserver.observe({ type: 'paint', buffered: true })
        this.observers.push(fcpObserver)
      } catch (e) {
        console.warn('FCP observer not supported')
      }
    }

    // 监控 TTFB
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries()
        entries.forEach((entry: any) => {
          this.metrics.TTFB = entry.responseStart - entry.requestStart
          this.scheduleReport()
        })
      })

      try {
        navigationObserver.observe({ type: 'navigation', buffered: true })
        this.observers.push(navigationObserver)
      } catch (e) {
        console.warn('Navigation observer not supported')
      }
    }
  }

  measureRouteChange(startTime: number, endTime: number) {
    this.metrics.routeChangeTime = endTime - startTime
    this.scheduleReport()
  }

  measureApiResponse(duration: number) {
    this.metrics.apiResponseTime = duration
    this.scheduleReport()
  }

  measureRender(duration: number) {
    this.metrics.renderTime = duration
    this.scheduleReport()
  }

  private scheduleReport() {
    // 收集完整指标后再报告
    const requiredMetrics = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB']
    const hasAllMetrics = requiredMetrics.every(
      metric => this.metrics[metric as keyof WebVitalsMetrics] !== undefined,
    )

    if (hasAllMetrics) {
      this.reportMetrics()
    }
  }

  private reportMetrics() {
    const completeMetrics: WebVitalsMetrics = {
      ...this.metrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: this.getConnectionType(),
      deviceMemory: this.getDeviceMemory(),
      hardwareConcurrency: navigator.hardwareConcurrency || 1,
      timestamp: Date.now(),
    } as WebVitalsMetrics

    this.addToBatch(completeMetrics)
    this.resetMetrics()
  }

  private addToBatch(metrics: WebVitalsMetrics) {
    this.metricsBuffer.push(metrics)

    if (this.metricsBuffer.length >= this.batchSize) {
      this.flushBatch()
    } else if (!this.flushTimer) {
      this.flushTimer = window.setTimeout(
        () => this.flushBatch(),
        this.batchTimeout,
      )
    }
  }

  private async flushBatch() {
    if (this.metricsBuffer.length === 0) return

    const batch = [...this.metricsBuffer]
    this.metricsBuffer = []

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }

    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics: batch }),
      })
    } catch (error) {
      console.warn('Failed to report web vitals:', error)
      // 失败的指标重新加入缓冲区
      this.metricsBuffer.unshift(...batch)
    }
  }

  private getConnectionType(): string {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection

    return connection?.effectiveType || 'unknown'
  }

  private getDeviceMemory(): number {
    return (navigator as any).deviceMemory || 4
  }

  private resetMetrics() {
    this.metrics = {}
  }

  private setupUnloadHandler() {
    // 在页面卸载前发送剩余指标
    const handleUnload = () => {
      if (this.metricsBuffer.length > 0) {
        if ('sendBeacon' in navigator) {
          navigator.sendBeacon(
            this.reportEndpoint,
            JSON.stringify({ metrics: this.metricsBuffer }),
          )
        }
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
    }
  }
}

// 集成到 Vue 应用
export const setupWebVitalsMonitoring = (app: any) => {
  const monitor = new WebVitalsMonitor()

  // 监控路由变化
  const router = app.config.globalProperties.$router
  if (router) {
    router.beforeEach((to: any, from: any, next: any) => {
      const startTime = performance.now()

      router.afterEach(() => {
        const endTime = performance.now()
        monitor.measureRouteChange(startTime, endTime)
      })

      next()
    })
  }

  // 监控 API 请求
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const startTime = performance.now()

    try {
      const response = await originalFetch(...args)
      const endTime = performance.now()
      monitor.measureApiResponse(endTime - startTime)
      return response
    } catch (error) {
      const endTime = performance.now()
      monitor.measureApiResponse(endTime - startTime)
      throw error
    }
  }

  return monitor
}

// 全局监控实例
export const webVitalsMonitor = new WebVitalsMonitor()
```

## 🛠️ 实践操作

### 步骤1：配置 Cloudflare Analytics

```bash
# 1. 在 Cloudflare Dashboard 中启用 Analytics Engine
# 2. 创建数据集
wrangler analytics-engine create vue_blog_metrics

# 3. 更新 wrangler.toml
cat >> wrangler.toml << EOF
[[analytics_engine_datasets]]
binding = "ANALYTICS_ENGINE"
dataset = "vue_blog_metrics"
EOF
```

### 步骤2：部署监控中间件

```typescript
// src/index.ts - 集成监控中间件
import { advancedPerformanceMiddleware } from './middleware/performance-advanced'
import { analyticsEngine } from './utils/analytics-engine'

// 应用中间件
app.use(advancedPerformanceMiddleware)

// 添加健康检查端点
app.get('/api/health/detailed', async c => {
  const optimizer = new DatabaseOptimizer()
  const report = await optimizer.generateOptimizationReport()

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    performance: {
      slowQueries: report.slowQueries.length,
      suggestedOptimizations: report.indexSuggestions.length,
      trends: report.performanceTrends,
    },
  })
})
```

### 步骤3：设置自动化监控告警

```typescript
// scripts/setup-monitoring.ts
import { CacheWarmer, setupCacheWarmupRules } from '../src/utils/cache-warmer'

export async function setupMonitoring(env: any) {
  // 设置缓存预热
  const warmer = new CacheWarmer()
  setupCacheWarmupRules(warmer, env.DB)

  // 执行初始预热
  console.log('Starting initial cache warmup...')
  const result = await warmer.warmupCache(env)
  console.log('Cache warmup result:', result)

  // 设置定期任务（通过 Cron Triggers）
  return {
    warmer,
    scheduledTasks: [
      'cache-warmup', // 每15分钟
      'performance-analysis', // 每小时
      'health-check', // 每5分钟
    ],
  }
}
```

### 步骤4：配置 Cron 触发器

```toml
# wrangler.toml - 添加定时任务
[[triggers]]
crons = ["*/15 * * * *"] # 每15分钟执行缓存预热

[[triggers]]
crons = ["0 * * * *"] # 每小时执行性能分析

[[triggers]]
crons = ["*/5 * * * *"] # 每5分钟健康检查
```

```typescript
// src/scheduled.ts - 定时任务处理
export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  switch (event.cron) {
    case '*/15 * * * *':
      // 缓存预热
      await cacheWarmer.schedulePeriodicWarmup(env)
      break

    case '0 * * * *':
      // 性能分析
      const report = await dbOptimizer.generateOptimizationReport()
      if (report.slowQueries.length > 0) {
        await sendPerformanceAlert(report, env)
      }
      break

    case '*/5 * * * *':
      // 健康检查
      await performHealthCheck(env)
      break
  }

  return new Response('OK')
}

async function sendPerformanceAlert(report: any, env: any) {
  const message = {
    text: `⚡ 性能报告：发现 ${report.slowQueries.length} 个慢查询`,
    details: report.slowQueries.slice(0, 5), // 显示前5个
  }

  // 发送告警
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
}
```

## 🔍 深入思考

### 性能监控的层次化策略

1. **实时监控**：关键指标的实时追踪和告警
2. **趋势分析**：长期性能趋势的识别和预测
3. **根因分析**：性能问题的深度分析和定位
4. **预防性优化**：基于历史数据的主动优化

### 监控数据的价值挖掘

```typescript
// 监控数据分析示例
const performanceInsights = {
  // 用户行为分析
  userJourney: {
    bounceRate: 0.25, // 跳出率
    averageSessionTime: 180, // 平均会话时长
    pageViewsPerSession: 3.5, // 每会话页面浏览量
    conversionFunnels: {
      register: 0.12,
      login: 0.85,
      publish: 0.3,
    },
  },

  // 性能基准
  benchmarks: {
    loadTime: { target: 2000, current: 1850, trend: 'improving' },
    apiResponseTime: { target: 500, current: 320, trend: 'stable' },
    errorRate: { target: 0.01, current: 0.005, trend: 'improving' },
  },

  // 优化建议
  recommendations: [
    {
      type: 'database',
      priority: 'high',
      description: '为 articles.author_id 添加索引',
      impact: '预计减少30%查询时间',
    },
    {
      type: 'cache',
      priority: 'medium',
      description: '增加用户个人资料缓存',
      impact: '减少重复数据库查询',
    },
  ],
}
```

## ❓ 遇到的问题

### 问题 1：监控数据量过大导致成本增加

**问题描述**：大量监控数据导致 Analytics Engine 成本快速增长  
**解决方案**：

```typescript
// 智能采样策略
const shouldSample = (metrics: PerformanceMetrics): boolean => {
  // 总是记录错误和慢请求
  if (metrics.status >= 400 || metrics.duration > 1000) {
    return true
  }

  // 正常请求按比例采样
  return Math.random() < 0.1 // 10% 采样率
}
```

### 问题 2：监控系统本身影响性能

**问题描述**：监控代码增加了请求延迟  
**解决方案**：

- 使用异步处理避免阻塞主流程
- 批量发送监控数据减少网络开销
- 在 Worker 中使用 `executionCtx.waitUntil()`

### 问题 3：监控告警噪音过多

**问题描述**：过多的告警导致重要问题被忽略  
**解决方案**：

- 设置合理的告警阈值和冷却时间
- 使用告警等级和分组
- 实施智能告警去重和聚合

## 💡 个人心得

### 今天最大的收获

建立了完整的性能监控体系，深入理解了如何在边缘计算环境中实现高效的性能监控和优化。

### 性能监控的核心洞察

1. **数据驱动**：基于真实数据而非猜测进行优化决策
2. **全链路监控**：从用户体验到基础设施的完整监控
3. **主动预防**：通过预测性分析提前发现问题
4. **持续改进**：监控-分析-优化的闭环循环

## 📋 行动清单

### 今日完成

- [x] 配置 Cloudflare Analytics Engine 数据收集
- [x] 实现高级性能监控中间件
- [x] 建立数据库查询优化系统
- [x] 设置前端 Core Web Vitals 监控

### 明日预习

- [ ] 了解项目文档编写最佳实践
- [ ] 准备架构迁移总结报告
- [ ] 思考后续优化和扩展计划

## 🔗 有用链接

- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Performance Observer API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)
- [SQLite 性能优化](https://www.sqlite.org/optoverview.html)

---

**📝 明日重点**：完成项目文档更新和整个 V2 架构迁移的总结收尾工作。
