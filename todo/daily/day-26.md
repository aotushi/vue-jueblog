# Day 26: 错误处理和日志系统

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 完善 tRPC 错误处理机制
- [ ] 实现统一的错误码和错误消息
- [ ] 配置前端错误捕获和用户友好提示
- [ ] 设置后端日志记录系统

## 📚 学习笔记

### tRPC 错误处理机制

#### 统一错误定义

```typescript
// src/utils/errors.ts
export enum ErrorCode {
  // 认证相关错误 (1000-1099)
  UNAUTHORIZED = 1001,
  TOKEN_EXPIRED = 1002,
  INVALID_CREDENTIALS = 1003,
  INSUFFICIENT_PERMISSIONS = 1004,

  // 用户相关错误 (1100-1199)
  USER_NOT_FOUND = 1101,
  USER_ALREADY_EXISTS = 1102,
  INVALID_USER_DATA = 1103,
  USER_BANNED = 1104,

  // 文章相关错误 (1200-1299)
  ARTICLE_NOT_FOUND = 1201,
  ARTICLE_ACCESS_DENIED = 1202,
  ARTICLE_ALREADY_PUBLISHED = 1203,
  INVALID_ARTICLE_DATA = 1204,

  // 评论相关错误 (1300-1399)
  COMMENT_NOT_FOUND = 1301,
  COMMENT_ACCESS_DENIED = 1302,
  INVALID_COMMENT_DATA = 1303,
  COMMENT_TOO_LONG = 1304,

  // 系统相关错误 (9000-9999)
  INTERNAL_ERROR = 9001,
  DATABASE_ERROR = 9002,
  NETWORK_ERROR = 9003,
  VALIDATION_ERROR = 9004,
  RATE_LIMIT_EXCEEDED = 9005,
}

export interface AppError {
  code: ErrorCode
  message: string
  details?: any
  timestamp: number
  requestId?: string
}

export class BlogError extends Error {
  public readonly code: ErrorCode
  public readonly details?: any
  public readonly timestamp: number
  public readonly requestId?: string

  constructor(
    code: ErrorCode,
    message: string,
    details?: any,
    requestId?: string,
  ) {
    super(message)
    this.name = 'BlogError'
    this.code = code
    this.details = details
    this.timestamp = Date.now()
    this.requestId = requestId
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    }
  }
}

// 错误消息映射
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',

  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.INVALID_USER_DATA]: '用户数据格式错误',
  [ErrorCode.USER_BANNED]: '用户已被禁用',

  [ErrorCode.ARTICLE_NOT_FOUND]: '文章不存在',
  [ErrorCode.ARTICLE_ACCESS_DENIED]: '无权访问此文章',
  [ErrorCode.ARTICLE_ALREADY_PUBLISHED]: '文章已发布，无法重复发布',
  [ErrorCode.INVALID_ARTICLE_DATA]: '文章数据格式错误',

  [ErrorCode.COMMENT_NOT_FOUND]: '评论不存在',
  [ErrorCode.COMMENT_ACCESS_DENIED]: '无权访问此评论',
  [ErrorCode.INVALID_COMMENT_DATA]: '评论数据格式错误',
  [ErrorCode.COMMENT_TOO_LONG]: '评论内容过长',

  [ErrorCode.INTERNAL_ERROR]: '系统内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
  [ErrorCode.NETWORK_ERROR]: '网络请求失败',
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后重试',
}
```

#### tRPC 错误处理中间件

```typescript
// src/trpc/error-handler.ts
import { TRPCError } from '@trpc/server'
import { BlogError, ErrorCode, ERROR_MESSAGES } from '../utils/errors'
import { logger } from '../utils/logger'

export function createAppError(
  code: ErrorCode,
  details?: any,
  requestId?: string,
): TRPCError {
  const message = ERROR_MESSAGES[code] || '未知错误'
  const error = new BlogError(code, message, details, requestId)

  // 记录错误日志
  logger.error('Application Error', {
    code: error.code,
    message: error.message,
    details: error.details,
    requestId: error.requestId,
    stack: error.stack,
  })

  // 转换为 tRPC 错误
  let trpcCode:
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'INTERNAL_SERVER_ERROR'

  if (code >= 1000 && code < 1100) {
    trpcCode = 'UNAUTHORIZED'
  } else if (code >= 1100 && code < 9000) {
    trpcCode = 'BAD_REQUEST'
  } else if (
    [
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      ErrorCode.ARTICLE_ACCESS_DENIED,
    ].includes(code)
  ) {
    trpcCode = 'FORBIDDEN'
  } else if (
    [ErrorCode.USER_NOT_FOUND, ErrorCode.ARTICLE_NOT_FOUND].includes(code)
  ) {
    trpcCode = 'NOT_FOUND'
  } else {
    trpcCode = 'INTERNAL_SERVER_ERROR'
  }

  return new TRPCError({
    code: trpcCode,
    message: error.message,
    cause: error,
  })
}

// 全局错误处理器
export const errorHandler = (error: any, requestId?: string): TRPCError => {
  // 如果已经是 BlogError，直接转换
  if (error instanceof BlogError) {
    return createAppError(error.code, error.details, requestId)
  }

  // 如果已经是 TRPCError，直接返回
  if (error instanceof TRPCError) {
    return error
  }

  // 数据库错误处理
  if (error?.code === 'SQLITE_CONSTRAINT') {
    return createAppError(
      ErrorCode.DATABASE_ERROR,
      {
        originalError: error.message,
      },
      requestId,
    )
  }

  // Zod 验证错误
  if (error?.name === 'ZodError') {
    return createAppError(
      ErrorCode.VALIDATION_ERROR,
      {
        validationErrors: error.errors,
      },
      requestId,
    )
  }

  // 未知错误
  logger.error('Unknown Error', {
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    requestId,
  })

  return createAppError(
    ErrorCode.INTERNAL_ERROR,
    {
      originalError: error?.message,
    },
    requestId,
  )
}
```

#### 在 tRPC procedures 中使用错误处理

```typescript
// src/trpc/articles.ts
import { z } from 'zod'
import { publicProcedure, protectedProcedure } from './trpc'
import { createAppError, ErrorCode } from '../utils/errors'

export const articlesRouter = {
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const article = await ctx.db
          .prepare(
            'SELECT * FROM articles WHERE id = ? AND status = "published"',
          )
          .bind(input.id)
          .first()

        if (!article) {
          throw createAppError(ErrorCode.ARTICLE_NOT_FOUND)
        }

        return article
      } catch (error) {
        throw errorHandler(error, ctx.requestId)
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1),
        summary: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // 验证用户权限
        if (!ctx.user) {
          throw createAppError(ErrorCode.UNAUTHORIZED)
        }

        const article = await ctx.db
          .prepare(
            `
          INSERT INTO articles (id, title, content, summary, author_id, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'draft', ?)
        `,
          )
          .bind(
            generateId(),
            input.title,
            input.content,
            input.summary || '',
            ctx.user.id,
            new Date().toISOString(),
          )
          .run()

        return { id: article.meta.last_row_id, ...input }
      } catch (error) {
        throw errorHandler(error, ctx.requestId)
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // 检查文章是否存在
        const article = await ctx.db
          .prepare('SELECT * FROM articles WHERE id = ?')
          .bind(input.id)
          .first()

        if (!article) {
          throw createAppError(ErrorCode.ARTICLE_NOT_FOUND)
        }

        // 检查权限
        if (article.author_id !== ctx.user?.id) {
          throw createAppError(ErrorCode.ARTICLE_ACCESS_DENIED)
        }

        // 执行删除
        await ctx.db
          .prepare('DELETE FROM articles WHERE id = ?')
          .bind(input.id)
          .run()

        return { success: true }
      } catch (error) {
        throw errorHandler(error, ctx.requestId)
      }
    }),
}
```

### 日志系统实现

#### 结构化日志记录器

```typescript
// src/utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  userId?: string
  data?: any
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private level: LogLevel
  private context: string

  constructor(context = 'App', level = LogLevel.INFO) {
    this.context = context
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message: `[${this.context}] ${message}`,
      timestamp: new Date().toISOString(),
      requestId: this.getCurrentRequestId(),
      userId: this.getCurrentUserId(),
    }

    if (data) {
      if (data instanceof Error) {
        entry.error = {
          name: data.name,
          message: data.message,
          stack: data.stack,
        }
      } else {
        entry.data = data
      }
    }

    return entry
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) return

    const entry = this.createLogEntry(level, message, data)

    // 控制台输出（开发环境）
    if (process.env.NODE_ENV !== 'production') {
      const levelName = LogLevel[level]
      const timestamp = entry.timestamp
      const prefix = `[${timestamp}] [${levelName}]`

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(prefix, entry.message, entry.data)
          break
        case LogLevel.INFO:
          console.info(prefix, entry.message, entry.data)
          break
        case LogLevel.WARN:
          console.warn(prefix, entry.message, entry.data)
          break
        case LogLevel.ERROR:
          console.error(prefix, entry.message, entry.error || entry.data)
          break
      }
    }

    // 生产环境发送到日志服务
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(entry)
    }
  }

  private async sendToLogService(entry: LogEntry) {
    try {
      // 可以发送到各种日志服务
      // 如：Cloudflare Analytics, LogTail, DataDog 等

      // 示例：发送到自定义日志 API
      await fetch('/api/internal/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
    } catch (error) {
      // 日志发送失败时不应影响主业务逻辑
      console.error('Failed to send log:', error)
    }
  }

  private getCurrentRequestId(): string | undefined {
    // 在 Cloudflare Workers 中可以从 context 获取
    return globalThis.requestId
  }

  private getCurrentUserId(): string | undefined {
    // 从当前上下文获取用户ID
    return globalThis.currentUserId
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data)
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data)
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data)
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data)
  }

  // 创建子 logger
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.level)
  }
}

// 创建默认 logger 实例
export const logger = new Logger('VueBlog')

// 为不同模块创建专用 logger
export const dbLogger = logger.child('DB')
export const authLogger = logger.child('Auth')
export const apiLogger = logger.child('API')
```

#### 请求日志中间件

```typescript
// src/middleware/logging.ts
import { Context, Next } from 'hono'
import { apiLogger } from '../utils/logger'

export const loggingMiddleware = async (c: Context, next: Next) => {
  const start = Date.now()
  const requestId = generateRequestId()
  const method = c.req.method
  const url = c.req.url
  const userAgent = c.req.header('user-agent')

  // 设置全局请求ID
  globalThis.requestId = requestId

  // 记录请求开始
  apiLogger.info('Request started', {
    method,
    url,
    userAgent,
    requestId,
  })

  let error: any = null

  try {
    await next()
  } catch (err) {
    error = err
    throw err
  } finally {
    const duration = Date.now() - start
    const status = c.res.status

    // 记录请求完成
    if (error) {
      apiLogger.error('Request failed', {
        method,
        url,
        status,
        duration,
        requestId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      })
    } else {
      apiLogger.info('Request completed', {
        method,
        url,
        status,
        duration,
        requestId,
      })
    }

    // 设置响应头
    c.header('X-Request-ID', requestId)

    // 清理全局状态
    globalThis.requestId = undefined
  }
}

function generateRequestId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}
```

### 前端错误处理

#### 全局错误捕获

```typescript
// src/utils/error-handler.ts
import { BlogError, ErrorCode, ERROR_MESSAGES } from './errors'

export class FrontendErrorHandler {
  private errorCallbacks: Array<(error: BlogError) => void> = []

  constructor() {
    this.setupGlobalHandlers()
  }

  private setupGlobalHandlers() {
    // 捕获未处理的 Promise 错误
    window.addEventListener('unhandledrejection', event => {
      this.handleError(event.reason)
      event.preventDefault()
    })

    // 捕获 JavaScript 运行时错误
    window.addEventListener('error', event => {
      this.handleError(new Error(event.message))
    })

    // 捕获资源加载错误
    window.addEventListener(
      'error',
      event => {
        if (event.target !== window) {
          this.handleError(
            new Error(
              `Resource load failed: ${event.target?.src || 'unknown'}`,
            ),
          )
        }
      },
      true,
    )
  }

  handleError(error: any) {
    let appError: BlogError

    if (error instanceof BlogError) {
      appError = error
    } else if (error?.code && typeof error.code === 'number') {
      // tRPC 错误
      appError = new BlogError(
        error.code,
        error.message || ERROR_MESSAGES[error.code] || '未知错误',
        error.data,
      )
    } else {
      // 普通错误
      appError = new BlogError(
        ErrorCode.INTERNAL_ERROR,
        error?.message || '发生未知错误',
      )
    }

    // 发送错误报告
    this.reportError(appError)

    // 通知错误处理回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(appError)
      } catch (err) {
        console.error('Error in error callback:', err)
      }
    })
  }

  private async reportError(error: BlogError) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...error.toJSON(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      })
    } catch (err) {
      console.error('Failed to report error:', err)
    }
  }

  onError(callback: (error: BlogError) => void) {
    this.errorCallbacks.push(callback)
  }

  removeErrorHandler(callback: (error: BlogError) => void) {
    const index = this.errorCallbacks.indexOf(callback)
    if (index > -1) {
      this.errorCallbacks.splice(index, 1)
    }
  }
}

export const errorHandler = new FrontendErrorHandler()
```

#### Vue 错误处理集成

```typescript
// src/composables/useErrorHandler.ts
import { ref } from 'vue'
import { BlogError, ErrorCode } from '@/utils/errors'
import { errorHandler } from '@/utils/error-handler'

export function useErrorHandler() {
  const currentError = ref<BlogError | null>(null)
  const isShowingError = ref(false)

  // 显示用户友好的错误消息
  const showError = (error: BlogError) => {
    currentError.value = error
    isShowingError.value = true

    // 根据错误类型显示不同的提示
    if (error.code === ErrorCode.UNAUTHORIZED) {
      // 重定向到登录页
      router.push('/login')
    } else if (error.code === ErrorCode.NETWORK_ERROR) {
      // 显示网络错误提示
      showNetworkErrorToast()
    } else {
      // 显示通用错误提示
      showErrorToast(error.message)
    }

    // 自动隐藏错误提示
    setTimeout(() => {
      hideError()
    }, 5000)
  }

  const hideError = () => {
    currentError.value = null
    isShowingError.value = false
  }

  // 处理 API 错误
  const handleApiError = (error: any) => {
    if (error?.shape?.code && error?.shape?.message) {
      // tRPC 错误
      const appError = new BlogError(
        error.shape.code,
        error.shape.message,
        error.shape.data,
      )
      showError(appError)
    } else {
      // 其他错误
      errorHandler.handleError(error)
    }
  }

  // 注册全局错误处理器
  errorHandler.onError(showError)

  return {
    currentError,
    isShowingError,
    showError,
    hideError,
    handleApiError,
  }
}
```

## 🛠️ 实践操作

### 步骤1：实现统一错误处理

```typescript
// src/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { Context } from './context'
import { errorHandler } from './error-handler'

const t = initTRPC.context<Context>().create({
  errorFormatter: ({ error, ctx }) => {
    // 统一错误格式
    return {
      message: error.message,
      code: error.code,
      data: error.cause instanceof BlogError ? error.cause.toJSON() : undefined,
      requestId: ctx?.requestId,
    }
  },
})

export const publicProcedure = t.procedure.use(async ({ ctx, next }) => {
  try {
    return await next({ ctx })
  } catch (error) {
    throw errorHandler(error, ctx.requestId)
  }
})
```

### 步骤2：配置日志中间件

```typescript
// src/index.ts
import { Hono } from 'hono'
import { loggingMiddleware } from './middleware/logging'
import { trpcServer } from './trpc'

const app = new Hono()

// 应用日志中间件
app.use('*', loggingMiddleware)
app.use('/trpc/*', trpcServer)

export default app
```

### 步骤3：前端错误处理配置

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { errorHandler } from './utils/error-handler'

const app = createApp(App)

// 配置 Vue 错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err, info)
  errorHandler.handleError(err)
}

app.mount('#app')
```

## 🔍 深入思考

### 错误处理的层次架构

1. **应用层**：业务逻辑错误，用户操作错误
2. **服务层**：API 调用错误，数据验证错误
3. **数据层**：数据库操作错误，数据一致性错误
4. **系统层**：网络错误，服务不可用错误

### 日志记录的最佳实践

- **结构化日志**：使用 JSON 格式，便于查询分析
- **分级记录**：根据重要性分级，避免日志噪音
- **上下文信息**：包含请求ID、用户ID等关联信息
- **性能考虑**：异步发送，避免影响主要业务流程

## ❓ 遇到的问题

### 问题 1：错误信息过于技术化

**问题描述**：后端返回的错误信息用户难以理解  
**解决方案**：

- 实现错误码到用户友好消息的映射
- 根据用户角色显示不同详细程度的错误信息
- 提供错误恢复建议

### 问题 2：日志量过大影响性能

**问题描述**：详细日志记录影响应用性能  
**解决方案**：

- 实现日志级别控制
- 使用异步日志发送
- 设置日志采样率

## 💡 个人心得

### 今天最大的收获

建立了完整的错误处理和日志系统，理解了在分布式环境中追踪错误和调试问题的重要性。

### 错误处理的核心原则

1. **用户友好**：错误信息对用户有意义且可操作
2. **开发友好**：提供足够的调试信息
3. **系统稳定**：错误处理不应成为新的错误源
4. **可观测性**：通过日志和监控了解系统健康状况

## 📋 行动清单

### 今日完成

- [x] 设计统一的错误码和错误类型定义
- [x] 实现 tRPC 错误处理中间件
- [x] 建立结构化日志记录系统
- [x] 配置前端全局错误捕获和用户友好提示

### 明日预习

- [ ] 了解安全性加固最佳实践
- [ ] 思考 JWT 认证机制优化
- [ ] 准备请求频率限制实现

## 🔗 有用链接

- [tRPC 错误处理文档](https://trpc.io/docs/error-handling)
- [Cloudflare Workers 日志最佳实践](https://developers.cloudflare.com/workers/observability/logging/)
- [Vue 错误处理指南](https://vuejs.org/guide/best-practices/production-deployment.html#tracking-runtime-errors)
- [结构化日志格式标准](https://tools.ietf.org/html/rfc5424)

---

**📝 明日重点**：加强应用安全性，实现认证和权限控制机制。
