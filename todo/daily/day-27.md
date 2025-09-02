# Day 27: 安全性加固

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 审核和加强 JWT 认证机制
- [ ] 实现请求频率限制
- [ ] 配置 CORS 安全策略
- [ ] 验证用户输入和 SQL 注入防护

## 📚 学习笔记

### 现代 Web 应用安全防护体系

#### 安全威胁模型与防护层次

```
┌─────────────────────────────────────────────┐
│                用户层                        │  ← 社工攻击、钓鱼
├─────────────────────────────────────────────┤
│                前端层                        │  ← XSS、CSRF、点击劫持
├─────────────────────────────────────────────┤
│                网络层                        │  ← 中间人攻击、DNS劫持
├─────────────────────────────────────────────┤
│                API层                         │  ← 注入攻击、权限绕过
├─────────────────────────────────────────────┤
│                数据层                        │  ← SQL注入、数据泄露
└─────────────────────────────────────────────┘
```

**安全防护原则**：

1. **纵深防御**：多层安全机制互相补充
2. **最小权限**：用户和系统都只获得必需的权限
3. **零信任**：不信任任何请求，都要验证
4. **安全默认**：默认配置应该是安全的

#### JWT 认证安全强化

```typescript
// src/utils/jwt-security.ts
import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export interface JWTPayload {
  sub: string // 用户ID
  iat: number // 签发时间
  exp: number // 过期时间
  aud: string // 受众
  iss: string // 签发者
  jti: string // JWT ID，用于撤销
  scope: string[] // 权限范围
  fingerprint: string // 浏览器指纹
}

class SecureJWT {
  private readonly secret: Uint8Array
  private readonly issuer = 'vue-blog-api'
  private readonly audience = 'vue-blog-client'
  private readonly algorithm = 'HS256'

  constructor(secretKey: string) {
    // 使用 PBKDF2 增强密钥强度
    this.secret = this.deriveKey(secretKey)
  }

  private deriveKey(password: string): Uint8Array {
    const salt = 'vue-blog-jwt-salt-2024'
    return new TextEncoder().encode(
      createHash('sha256')
        .update(password + salt)
        .digest('hex')
        .slice(0, 32),
    )
  }

  // 生成浏览器指纹
  private generateFingerprint(userAgent: string, ip: string): string {
    return createHash('sha256')
      .update(userAgent + ip + Date.now().toString())
      .digest('hex')
      .slice(0, 16)
  }

  async signToken(
    userId: string,
    scope: string[],
    userAgent: string,
    ip: string,
    expirationMinutes = 60,
  ): Promise<{ token: string; fingerprint: string; jti: string }> {
    const now = Math.floor(Date.now() / 1000)
    const jti = randomBytes(16).toString('hex')
    const fingerprint = this.generateFingerprint(userAgent, ip)

    const payload: JWTPayload = {
      sub: userId,
      iat: now,
      exp: now + expirationMinutes * 60,
      aud: this.audience,
      iss: this.issuer,
      jti,
      scope,
      fingerprint,
    }

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: this.algorithm })
      .sign(this.secret)

    // 记录 JWT ID 用于撤销机制
    await this.recordJTI(jti, userId, now + expirationMinutes * 60)

    return { token, fingerprint, jti }
  }

  async verifyToken(
    token: string,
    expectedFingerprint: string,
    userAgent: string,
    ip: string,
  ): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      })

      const jwtPayload = payload as unknown as JWTPayload

      // 验证 JWT ID 是否被撤销
      if (await this.isJTIRevoked(jwtPayload.jti)) {
        throw new Error('Token has been revoked')
      }

      // 验证浏览器指纹
      if (
        !timingSafeEqual(
          Buffer.from(jwtPayload.fingerprint, 'hex'),
          Buffer.from(expectedFingerprint, 'hex'),
        )
      ) {
        throw new Error('Invalid client fingerprint')
      }

      return jwtPayload
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`)
    }
  }

  // JWT 撤销机制
  private async recordJTI(jti: string, userId: string, exp: number) {
    const db = globalThis.DB
    await db
      .prepare(
        `
      INSERT OR REPLACE INTO jwt_tokens (jti, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
      )
      .bind(jti, userId, exp, Date.now())
      .run()
  }

  private async isJTIRevoked(jti: string): Promise<boolean> {
    const db = globalThis.DB
    const result = await db
      .prepare(
        `
      SELECT revoked FROM jwt_tokens 
      WHERE jti = ? AND expires_at > ?
    `,
      )
      .bind(jti, Math.floor(Date.now() / 1000))
      .first()

    return result?.revoked === 1
  }

  async revokeToken(jti: string): Promise<void> {
    const db = globalThis.DB
    await db
      .prepare(
        `
      UPDATE jwt_tokens SET revoked = 1 
      WHERE jti = ?
    `,
      )
      .bind(jti)
      .run()
  }

  // 批量撤销用户所有令牌
  async revokeAllUserTokens(userId: string): Promise<void> {
    const db = globalThis.DB
    await db
      .prepare(
        `
      UPDATE jwt_tokens SET revoked = 1 
      WHERE user_id = ? AND expires_at > ?
    `,
      )
      .bind(userId, Math.floor(Date.now() / 1000))
      .run()
  }
}

// 导出单例实例
export const secureJWT = new SecureJWT(process.env.JWT_SECRET!)
```

### 请求频率限制实现

#### 滑动窗口限流算法

```typescript
// src/middleware/rate-limit.ts
import { Context, Next } from 'hono'

interface RateLimitRule {
  windowMs: number // 时间窗口（毫秒）
  maxRequests: number // 最大请求数
  keyGenerator?: (c: Context) => string // 自定义键生成器
  skipIf?: (c: Context) => boolean // 跳过条件
  onLimitReached?: (c: Context) => Response // 限制触发回调
}

class SlidingWindowRateLimit {
  private windows = new Map<string, number[]>()

  constructor(private config: RateLimitRule) {}

  async check(key: string): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    // 获取或创建窗口
    let requests = this.windows.get(key) || []

    // 清理过期请求
    requests = requests.filter(timestamp => timestamp > windowStart)

    // 检查是否超过限制
    const allowed = requests.length < this.config.maxRequests

    if (allowed) {
      requests.push(now)
      this.windows.set(key, requests)
    }

    const remaining = Math.max(0, this.config.maxRequests - requests.length)

    return { allowed, remaining }
  }

  // 定期清理过期数据
  cleanup(): void {
    const now = Date.now()
    for (const [key, requests] of this.windows.entries()) {
      const validRequests = requests.filter(
        timestamp => timestamp > now - this.config.windowMs,
      )

      if (validRequests.length === 0) {
        this.windows.delete(key)
      } else {
        this.windows.set(key, validRequests)
      }
    }
  }
}

// 令牌桶算法（用于突发流量控制）
class TokenBucket {
  private tokens: number
  private lastRefill: number

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  consume(tokensRequested = 1): boolean {
    this.refill()

    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested
      return true
    }

    return false
  }

  private refill(): void {
    const now = Date.now()
    const timePassed = (now - this.lastRefill) / 1000
    const tokensToAdd = timePassed * this.refillRate

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd)
    this.lastRefill = now
  }
}

// 分布式限流（使用 Cloudflare D1）
class DistributedRateLimit {
  constructor(private db: D1Database) {}

  async checkLimit(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = now - windowMs
    const resetTime = now + windowMs

    // 使用事务确保原子性
    const result = await this.db.batch([
      // 清理过期记录
      this.db
        .prepare(
          `
        DELETE FROM rate_limit_requests 
        WHERE key = ? AND timestamp < ?
      `,
        )
        .bind(key, windowStart),

      // 统计当前窗口请求数
      this.db
        .prepare(
          `
        SELECT COUNT(*) as count 
        FROM rate_limit_requests 
        WHERE key = ? AND timestamp >= ?
      `,
        )
        .bind(key, windowStart),

      // 如果允许，记录新请求
      this.db
        .prepare(
          `
        INSERT INTO rate_limit_requests (key, timestamp) 
        SELECT ?, ? 
        WHERE (
          SELECT COUNT(*) 
          FROM rate_limit_requests 
          WHERE key = ? AND timestamp >= ?
        ) < ?
      `,
        )
        .bind(key, now, key, windowStart, maxRequests),
    ])

    const currentCount = result[1].results?.[0]?.count || 0
    const insertResult = result[2]

    const allowed = insertResult.changes > 0
    const remaining = Math.max(
      0,
      maxRequests - currentCount - (allowed ? 1 : 0),
    )

    return { allowed, remaining, resetTime }
  }
}

// 创建速率限制中间件
export function createRateLimit(config: RateLimitRule) {
  const limiter = new SlidingWindowRateLimit(config)

  // 每5分钟清理一次过期数据
  setInterval(() => limiter.cleanup(), 5 * 60 * 1000)

  return async (c: Context, next: Next) => {
    // 检查是否跳过限流
    if (config.skipIf && config.skipIf(c)) {
      return next()
    }

    // 生成限流键
    const key = config.keyGenerator
      ? config.keyGenerator(c)
      : `${c.req.header('x-real-ip') || 'unknown'}:${c.req.path}`

    // 检查限流
    const { allowed, remaining } = await limiter.check(key)

    // 设置响应头
    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', remaining.toString())
    c.header('X-RateLimit-Reset', (Date.now() + config.windowMs).toString())

    if (!allowed) {
      // 触发限流回调
      if (config.onLimitReached) {
        return config.onLimitReached(c)
      }

      // 默认限流响应
      return c.json(
        {
          error: 'Too Many Requests',
          message: '请求过于频繁，请稍后重试',
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
        429,
      )
    }

    return next()
  }
}

// 预定义的限流规则
export const rateLimits = {
  // 严格限流：登录、注册等敏感操作
  strict: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 5,
    keyGenerator: c => `strict:${c.req.header('x-real-ip')}`,
    onLimitReached: c =>
      c.json(
        {
          error: 'Security Lock',
          message: '频繁尝试已触发安全锁定，请15分钟后重试',
        },
        429,
      ),
  }),

  // 一般限流：API 请求
  moderate: createRateLimit({
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 60,
    keyGenerator: c => `api:${c.req.header('x-real-ip')}`,
  }),

  // 宽松限流：静态资源
  lenient: createRateLimit({
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 200,
    keyGenerator: c => `static:${c.req.header('x-real-ip')}`,
  }),
}
```

### CORS 安全策略配置

#### 精确的跨域配置

```typescript
// src/middleware/cors.ts
import { Context, Next } from 'hono'

interface CorsConfig {
  origins: string[] | RegExp[] | ((origin: string) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
  preflightContinue?: boolean
}

class SecureCorsHandler {
  constructor(private config: CorsConfig) {}

  private isOriginAllowed(origin: string): boolean {
    if (!origin) return false

    if (typeof this.config.origins === 'function') {
      return this.config.origins(origin)
    }

    if (Array.isArray(this.config.origins)) {
      return this.config.origins.some(allowed => {
        if (typeof allowed === 'string') {
          return allowed === origin
        }
        if (allowed instanceof RegExp) {
          return allowed.test(origin)
        }
        return false
      })
    }

    return false
  }

  private setCommonHeaders(c: Context, origin?: string): void {
    const headers = c.res.headers

    // 基本 CORS 头部
    if (origin && this.isOriginAllowed(origin)) {
      headers.set('Access-Control-Allow-Origin', origin)
    }

    if (this.config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true')
    }

    if (this.config.exposedHeaders?.length) {
      headers.set(
        'Access-Control-Expose-Headers',
        this.config.exposedHeaders.join(', '),
      )
    }

    // 安全头部
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // CSP 头部
    headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "media-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
      ].join('; '),
    )
  }

  async handle(c: Context, next: Next): Promise<Response | void> {
    const origin = c.req.header('Origin')
    const method = c.req.method.toUpperCase()

    // 预检请求处理
    if (method === 'OPTIONS') {
      return this.handlePreflight(c, origin)
    }

    // 设置响应头
    this.setCommonHeaders(c, origin)

    // 检查 Origin
    if (origin && !this.isOriginAllowed(origin)) {
      return c.json(
        {
          error: 'CORS Error',
          message: '不允许的跨域访问',
        },
        403,
      )
    }

    return next()
  }

  private handlePreflight(c: Context, origin?: string): Response {
    const requestMethod = c.req.header('Access-Control-Request-Method')
    const requestHeaders = c.req.header('Access-Control-Request-Headers')

    // 检查 Origin
    if (!origin || !this.isOriginAllowed(origin)) {
      return c.json(
        {
          error: 'CORS Preflight Error',
          message: '预检请求被拒绝',
        },
        403,
      )
    }

    // 设置预检响应头
    const headers = new Headers()
    headers.set('Access-Control-Allow-Origin', origin)

    if (this.config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true')
    }

    if (this.config.methods?.includes(requestMethod!)) {
      headers.set(
        'Access-Control-Allow-Methods',
        this.config.methods.join(', '),
      )
    }

    if (this.config.allowedHeaders) {
      headers.set(
        'Access-Control-Allow-Headers',
        this.config.allowedHeaders.join(', '),
      )
    }

    if (this.config.maxAge) {
      headers.set('Access-Control-Max-Age', this.config.maxAge.toString())
    }

    // 设置安全头部
    this.setCommonHeaders(c, origin)

    return new Response(null, { status: 204, headers })
  }
}

// 环境特定的 CORS 配置
export const createCorsMiddleware = (env: 'development' | 'production') => {
  const config: CorsConfig = {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Client-Fingerprint',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-Request-ID',
    ],
    credentials: true,
    maxAge: 86400, // 24小时
    origins:
      env === 'development'
        ? [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173', // Vite dev server
            /^http:\/\/localhost:\d+$/, // 任意本地端口
          ]
        : [
            'https://vue-blog.example.com',
            'https://blog.example.com',
            /^https:\/\/.*\.example\.com$/, // 子域名
          ],
  }

  const corsHandler = new SecureCorsHandler(config)
  return corsHandler.handle.bind(corsHandler)
}
```

### 输入验证与 SQL 注入防护

#### 全面的数据验证体系

```typescript
// src/utils/input-validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// 自定义 Zod 验证器
const createSecureValidators = () => {
  // 手机号验证
  const phoneSchema = z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .transform(phone => phone.replace(/\s+/g, ''))

  // 密码强度验证
  const passwordSchema = z
    .string()
    .min(8, '密码至少8位')
    .max(128, '密码不能超过128位')
    .regex(/^(?=.*[a-z])/, '密码必须包含小写字母')
    .regex(/^(?=.*[A-Z])/, '密码必须包含大写字母')
    .regex(/^(?=.*\d)/, '密码必须包含数字')
    .regex(/^(?=.*[!@#$%^&*(),.?":{}|<>])/, '密码必须包含特殊字符')
    .refine(
      password => {
        // 检查常见弱密码
        const commonPasswords = [
          'password',
          '123456789',
          'qwertyuiop',
          'admin123',
          'password123',
        ]
        return !commonPasswords.includes(password.toLowerCase())
      },
      { message: '密码过于简单，请使用更复杂的密码' },
    )

  // 用户名验证（防止 XSS）
  const usernameSchema = z
    .string()
    .min(2, '用户名至少2个字符')
    .max(20, '用户名不能超过20个字符')
    .regex(
      /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
      '用户名只能包含字母、数字、下划线和中文',
    )
    .transform(username => DOMPurify.sanitize(username))

  // 邮箱验证
  const emailSchema = z
    .string()
    .email('邮箱格式不正确')
    .max(254, '邮箱地址过长')
    .toLowerCase()
    .transform(email => email.trim())

  // HTML 内容验证和清理
  const htmlContentSchema = z
    .string()
    .max(50000, '内容过长')
    .transform(html => {
      // 配置 DOMPurify 允许的标签和属性
      const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'u',
          's',
          'sub',
          'sup',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'blockquote',
          'pre',
          'code',
          'a',
          'img',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
        ],
        ALLOWED_ATTR: [
          'href',
          'title',
          'alt',
          'src',
          'width',
          'height',
          'class',
          'id',
          'target',
          'rel',
        ],
        ALLOWED_URI_REGEXP:
          /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      })

      return cleanHtml
    })

  // URL 验证
  const urlSchema = z
    .string()
    .url('URL 格式不正确')
    .refine(
      url => {
        const parsedUrl = new URL(url)
        // 只允许 HTTP(S) 协议
        return ['http:', 'https:'].includes(parsedUrl.protocol)
      },
      { message: '只允许 HTTP 或 HTTPS 协议' },
    )
    .refine(
      url => {
        const parsedUrl = new URL(url)
        // 禁止内网地址
        const hostname = parsedUrl.hostname
        return !hostname.match(
          /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|localhost)/,
        )
      },
      { message: '不允许访问内网地址' },
    )

  return {
    phoneSchema,
    passwordSchema,
    usernameSchema,
    emailSchema,
    htmlContentSchema,
    urlSchema,
  }
}

// SQL 参数化查询包装器
class SafeQuery {
  constructor(private db: D1Database) {}

  // 安全的查询方法
  async select<T>(
    sql: string,
    params: unknown[] = [],
    options: { limit?: number; offset?: number } = {},
  ): Promise<T[]> {
    // 验证 SQL 语句（基本的白名单检查）
    this.validateSelectQuery(sql)

    // 应用分页限制
    const { limit = 100, offset = 0 } = options
    const limitedSql = `${sql} LIMIT ? OFFSET ?`
    const limitedParams = [
      ...params,
      Math.min(limit, 1000),
      Math.max(offset, 0),
    ]

    const result = await this.db
      .prepare(limitedSql)
      .bind(...limitedParams)
      .all()
    return result.results as T[]
  }

  async insert(sql: string, params: unknown[] = []): Promise<D1Result> {
    this.validateInsertQuery(sql)
    return await this.db
      .prepare(sql)
      .bind(...params)
      .run()
  }

  async update(sql: string, params: unknown[] = []): Promise<D1Result> {
    this.validateUpdateQuery(sql)
    return await this.db
      .prepare(sql)
      .bind(...params)
      .run()
  }

  async delete(sql: string, params: unknown[] = []): Promise<D1Result> {
    this.validateDeleteQuery(sql)
    return await this.db
      .prepare(sql)
      .bind(...params)
      .run()
  }

  // SQL 注入防护验证
  private validateSelectQuery(sql: string): void {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim()

    // 检查是否是 SELECT 语句
    if (!normalizedSql.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed')
    }

    // 禁用的关键字检查
    const forbiddenKeywords = [
      'drop',
      'create',
      'alter',
      'truncate',
      'exec',
      'execute',
      'sp_',
      'xp_',
      '--',
      '/*',
      '*/',
      'union',
      'script',
    ]

    for (const keyword of forbiddenKeywords) {
      if (normalizedSql.includes(keyword)) {
        throw new Error(`Forbidden keyword detected: ${keyword}`)
      }
    }
  }

  private validateInsertQuery(sql: string): void {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim()

    if (!normalizedSql.startsWith('insert into')) {
      throw new Error('Only INSERT INTO queries are allowed')
    }

    this.checkForbiddenPatterns(normalizedSql)
  }

  private validateUpdateQuery(sql: string): void {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim()

    if (!normalizedSql.startsWith('update')) {
      throw new Error('Only UPDATE queries are allowed')
    }

    // UPDATE 必须有 WHERE 条件（防止全表更新）
    if (!normalizedSql.includes(' where ')) {
      throw new Error('UPDATE queries must include WHERE clause')
    }

    this.checkForbiddenPatterns(normalizedSql)
  }

  private validateDeleteQuery(sql: string): void {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim()

    if (!normalizedSql.startsWith('delete from')) {
      throw new Error('Only DELETE FROM queries are allowed')
    }

    // DELETE 必须有 WHERE 条件（防止全表删除）
    if (!normalizedSql.includes(' where ')) {
      throw new Error('DELETE queries must include WHERE clause')
    }

    this.checkForbiddenPatterns(normalizedSql)
  }

  private checkForbiddenPatterns(sql: string): void {
    const forbiddenPatterns = [
      /drop\s+table/i,
      /create\s+table/i,
      /alter\s+table/i,
      /exec\s*\(/i,
      /execute\s*\(/i,
      /sp_\w+/i,
      /xp_\w+/i,
      /--/,
      /\/\*/,
      /\*\//,
      /union\s+select/i,
      /<script/i,
    ]

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sql)) {
        throw new Error(`Forbidden SQL pattern detected: ${pattern}`)
      }
    }
  }
}

// 创建安全的数据库查询实例
export const createSafeDB = (db: D1Database) => new SafeQuery(db)

// 导出验证器
export const validators = createSecureValidators()

// 通用验证中间件
export const validateInput = (schema: z.ZodSchema) => {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json()
      const validatedData = schema.parse(body)

      // 将验证后的数据附加到上下文
      c.set('validatedData', validatedData)

      return next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: 'Validation Error',
            message: '输入数据验证失败',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
          400,
        )
      }

      throw error
    }
  }
}
```

## 🛠️ 实践操作

### 步骤1：实施 JWT 安全增强

```typescript
// src/trpc/auth.ts
import { z } from 'zod'
import { publicProcedure, protectedProcedure } from './trpc'
import { secureJWT } from '@/utils/jwt-security'
import { validators } from '@/utils/input-validation'

export const authRouter = {
  login: publicProcedure
    .input(
      z.object({
        phone: validators.phoneSchema,
        password: z.string().min(1, '密码不能为空'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { phone, password } = input
      const userAgent = ctx.req.header('user-agent') || ''
      const ip = ctx.req.header('x-real-ip') || '127.0.0.1'

      // 验证用户凭据
      const user = await ctx.db
        .prepare(
          `
        SELECT id, username, password_hash, status 
        FROM users 
        WHERE phone = ?
      `,
        )
        .bind(phone)
        .first()

      if (!user || !(await verifyPassword(password, user.password_hash))) {
        throw new Error('手机号或密码错误')
      }

      if (user.status !== 'active') {
        throw new Error('账户已被禁用')
      }

      // 生成安全 JWT
      const { token, fingerprint, jti } = await secureJWT.signToken(
        user.id,
        ['read', 'write'], // 用户权限
        userAgent,
        ip,
        60, // 60分钟过期
      )

      return {
        user: {
          id: user.id,
          username: user.username,
        },
        token,
        fingerprint,
        expiresAt: Date.now() + 60 * 60 * 1000,
      }
    }),

  refreshToken: protectedProcedure.mutation(async ({ ctx }) => {
    const userAgent = ctx.req.header('user-agent') || ''
    const ip = ctx.req.header('x-real-ip') || '127.0.0.1'

    // 生成新的 token
    const { token, fingerprint, jti } = await secureJWT.signToken(
      ctx.user.id,
      ctx.user.scope,
      userAgent,
      ip,
      60,
    )

    return { token, fingerprint }
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // 撤销当前 token
    await secureJWT.revokeToken(ctx.jti)
    return { success: true }
  }),

  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    // 撤销用户所有 token
    await secureJWT.revokeAllUserTokens(ctx.user.id)
    return { success: true }
  }),
}
```

### 步骤2：配置安全中间件堆栈

```typescript
// src/index.ts
import { Hono } from 'hono'
import { createCorsMiddleware } from './middleware/cors'
import { rateLimits } from './middleware/rate-limit'
import { securityHeaders } from './middleware/security'

const app = new Hono()

// 安全头部中间件
app.use('*', securityHeaders)

// CORS 配置
app.use('*', createCorsMiddleware(process.env.NODE_ENV as any))

// 分层限流策略
app.use('/api/auth/*', rateLimits.strict) // 认证接口严格限流
app.use('/api/trpc/*', rateLimits.moderate) // API 接口适中限流
app.use('/api/static/*', rateLimits.lenient) // 静态资源宽松限流

// 路由配置
app.route('/api/trpc', trpcServer)

export default app
```

### 步骤3：数据库安全表结构

```sql
-- 用户安全相关表
CREATE TABLE IF NOT EXISTS jwt_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jti TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  INDEX idx_jwt_tokens_jti (jti),
  INDEX idx_jwt_tokens_user_id (user_id),
  INDEX idx_jwt_tokens_expires_at (expires_at)
);

-- 限流记录表
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  INDEX idx_rate_limit_key_timestamp (key, timestamp)
);

-- 安全事件日志表
CREATE TABLE IF NOT EXISTS security_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_path TEXT,
  severity TEXT DEFAULT 'info',
  details TEXT,
  created_at INTEGER NOT NULL,
  INDEX idx_security_logs_type_time (event_type, created_at),
  INDEX idx_security_logs_user_id (user_id)
);
```

## 🔍 深入思考

### 安全防护的层次化设计

1. **网络层安全**：HTTPS、HSTS、DNS安全
2. **应用层安全**：认证、授权、输入验证
3. **数据层安全**：加密存储、访问控制
4. **运维层安全**：监控、日志、应急响应

### 安全与用户体验的平衡

- **渐进式安全**：根据操作敏感度调整安全级别
- **透明化防护**：安全机制对用户尽可能透明
- **友好的错误提示**：安全错误不暴露系统细节

## ❓ 遇到的问题

### 问题 1：过度安全影响体验

**问题描述**：严格的安全策略影响了用户正常使用  
**解决方案**：

- 实现基于风险的自适应认证
- 提供安全设置的用户自定义选项
- 使用机器学习识别异常行为

### 问题 2：性能与安全的权衡

**问题描述**：安全检查增加了系统响应时间  
**解决方案**：

- 使用异步处理非关键安全检查
- 实现智能缓存减少重复验证
- 优化算法和数据结构

## 💡 个人心得

### 今天最大的收获

理解了现代 Web 应用安全的复杂性，以及如何在保障安全的同时维护良好的用户体验。

### 安全防护的核心原则

1. **纵深防御**：多层防护机制相互补充
2. **最小权限**：用户和系统只获得必要的权限
3. **零信任架构**：不信任任何输入和请求
4. **持续监控**：实时检测和响应安全威胁

## 📋 行动清单

### 今日完成

- [x] 强化 JWT 认证机制，增加指纹验证和撤销功能
- [x] 实现多层次请求频率限制策略
- [x] 配置严格的 CORS 和安全头部策略
- [x] 建立全面的输入验证和 SQL 注入防护

### 明日预习

- [ ] 了解单元测试和集成测试策略
- [ ] 思考测试覆盖率和质量保证流程
- [ ] 准备 E2E 自动化测试环境

## 🔗 有用链接

- [OWASP Top 10 安全风险](https://owasp.org/www-project-top-ten/)
- [JWT 安全最佳实践](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Cloudflare 安全特性](https://developers.cloudflare.com/security/)
- [Content Security Policy 指南](https://web.dev/csp/)

---

**📝 明日重点**：建立全面的测试体系，确保代码质量和系统稳定性。
