# Day 28: 单元测试编写

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 为关键 procedures 编写单元测试
- [ ] 测试数据验证逻辑
- [ ] 测试认证中间件
- [ ] 配置测试数据库环境

## 📚 学习笔记

### 单元测试策略与最佳实践

#### 测试驱动开发 (TDD) 理念

```
TDD 循环：红-绿-重构
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   红色阶段   │ -> │   绿色阶段   │ -> │  重构阶段    │
│ 编写失败测试  │    │ 让测试通过   │    │ 优化代码    │
└─────────────┘    └─────────────┘    └─────────────┘
       ^                                      │
       └──────────────────────────────────────┘
```

**TDD 核心原则**：

1. **先写测试**：在编写实现代码之前先写测试
2. **最小实现**：编写最少的代码来让测试通过
3. **持续重构**：在测试保护下持续改进代码
4. **快速反馈**：快速验证代码的正确性

#### tRPC Procedures 测试框架

```typescript
// src/trpc/__tests__/test-utils.ts
import { initTRPC } from '@trpc/server'
import { createTRPCMsw } from 'msw-trpc'
import { setupServer } from 'msw/node'
import { vi } from 'vitest'

// Mock Context 类型定义
export interface MockContext {
  db: D1Database
  user: {
    id: string
    username: string
    role: string
    scope: string[]
  } | null
  req: {
    header: (name: string) => string | undefined
  }
  requestId: string
}

// 创建测试用 tRPC 实例
export const createTestTRPC = () => {
  return initTRPC.context<MockContext>().create({
    errorFormatter: ({ shape }) => shape,
  })
}

// 创建 Mock 数据库
export const createMockDB = (): D1Database => {
  const mockResults = new Map<string, any>()

  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...params: any[]) => ({
        first: vi.fn(() => mockResults.get(`${sql}:first`)),
        all: vi.fn(() => ({
          results: mockResults.get(`${sql}:all`) || [],
        })),
        run: vi.fn(() => ({
          success: true,
          meta: {
            changes: 1,
            last_row_id: Math.floor(Math.random() * 1000),
          },
        })),
      })),
      first: vi.fn(() => mockResults.get(`${sql}:first`)),
      all: vi.fn(() => ({
        results: mockResults.get(`${sql}:all`) || [],
      })),
      run: vi.fn(() => ({
        success: true,
        meta: { changes: 1 },
      })),
    })),
    batch: vi.fn(() => Promise.resolve([])),
    exec: vi.fn(() => Promise.resolve({ results: [] })),
    dump: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    // 添加用于设置模拟数据的方法
    __setMockData: (key: string, data: any) => {
      mockResults.set(key, data)
    },
  } as any
}

// 创建 Mock Context
export const createMockContext = (
  overrides: Partial<MockContext> = {},
): MockContext => {
  return {
    db: createMockDB(),
    user: null,
    req: {
      header: vi.fn(() => undefined),
    },
    requestId: 'test-request-id',
    ...overrides,
  }
}

// 测试数据工厂
export const createTestUser = (overrides = {}) => ({
  id: 'user-1',
  username: 'testuser',
  phone: '13800138000',
  email: 'test@example.com',
  password_hash: '$2b$10$encrypted_password_hash',
  status: 'active',
  role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createTestArticle = (overrides = {}) => ({
  id: 'article-1',
  title: '测试文章标题',
  content: '这是测试文章的内容。包含一些示例文本用于验证功能。',
  summary: '测试文章摘要',
  cover: 'https://example.com/cover.jpg',
  status: 'published',
  author_id: 'user-1',
  view_count: 0,
  like_count: 0,
  comment_count: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  published_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createTestComment = (overrides = {}) => ({
  id: 'comment-1',
  content: '这是一条测试评论',
  article_id: 'article-1',
  user_id: 'user-1',
  parent_id: null,
  status: 'published',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})
```

### 认证系统单元测试

#### JWT 中间件测试

```typescript
// src/trpc/__tests__/middleware/auth.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { authMiddleware } from '../../middleware/auth'
import { createMockContext, createTestUser } from '../test-utils'
import * as jwtUtils from '../../../utils/jwt-security'

// Mock JWT 工具
vi.mock('../../../utils/jwt-security', () => ({
  secureJWT: {
    verifyToken: vi.fn(),
  },
}))

describe('Auth Middleware', () => {
  let mockContext: any

  beforeEach(() => {
    mockContext = createMockContext()
    vi.clearAllMocks()
  })

  describe('无认证要求的请求', () => {
    it('应该允许无 Token 的请求通过', async () => {
      const next = vi.fn(() => Promise.resolve())

      await authMiddleware({
        ctx: mockContext,
        next,
        path: 'public.test',
        type: 'query',
      })

      expect(next).toHaveBeenCalled()
      expect(mockContext.user).toBe(null)
    })
  })

  describe('需要认证的请求', () => {
    it('应该在缺少 Authorization 头时抛出错误', async () => {
      const next = vi.fn()

      await expect(
        authMiddleware({
          ctx: mockContext,
          next,
          path: 'protected.test',
          type: 'mutation',
        }),
      ).rejects.toThrow(TRPCError)

      expect(next).not.toHaveBeenCalled()
    })

    it('应该在 Token 格式错误时抛出错误', async () => {
      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'authorization') return 'InvalidTokenFormat'
        return undefined
      })

      const next = vi.fn()

      await expect(
        authMiddleware({
          ctx: mockContext,
          next,
          path: 'protected.test',
          type: 'mutation',
        }),
      ).rejects.toThrow(TRPCError)

      expect(next).not.toHaveBeenCalled()
    })

    it('应该在 Token 验证失败时抛出错误', async () => {
      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'authorization') return 'Bearer invalid_token'
        if (name === 'x-client-fingerprint') return 'fingerprint'
        if (name === 'user-agent') return 'test-agent'
        if (name === 'x-real-ip') return '127.0.0.1'
        return undefined
      })

      vi.mocked(jwtUtils.secureJWT.verifyToken).mockRejectedValue(
        new Error('Token verification failed'),
      )

      const next = vi.fn()

      await expect(
        authMiddleware({
          ctx: mockContext,
          next,
          path: 'protected.test',
          type: 'mutation',
        }),
      ).rejects.toThrow(TRPCError)

      expect(next).not.toHaveBeenCalled()
    })

    it('应该在有效 Token 时设置用户上下文', async () => {
      const testUser = createTestUser()
      const mockPayload = {
        sub: testUser.id,
        scope: ['read', 'write'],
        jti: 'jwt-id',
      }

      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'authorization') return 'Bearer valid_token'
        if (name === 'x-client-fingerprint') return 'fingerprint'
        if (name === 'user-agent') return 'test-agent'
        if (name === 'x-real-ip') return '127.0.0.1'
        return undefined
      })

      // Mock 数据库查询
      mockContext.db.__setMockData(
        'SELECT * FROM users WHERE id = ?:first',
        testUser,
      )

      vi.mocked(jwtUtils.secureJWT.verifyToken).mockResolvedValue(mockPayload)

      const next = vi.fn(() => Promise.resolve())

      await authMiddleware({
        ctx: mockContext,
        next,
        path: 'protected.test',
        type: 'mutation',
      })

      expect(next).toHaveBeenCalled()
      expect(mockContext.user).toEqual({
        id: testUser.id,
        username: testUser.username,
        role: testUser.role,
        scope: mockPayload.scope,
      })
      expect(mockContext.jti).toBe(mockPayload.jti)
    })

    it('应该在用户不存在时抛出错误', async () => {
      const mockPayload = {
        sub: 'non-existent-user',
        scope: ['read'],
        jti: 'jwt-id',
      }

      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'authorization') return 'Bearer valid_token'
        if (name === 'x-client-fingerprint') return 'fingerprint'
        if (name === 'user-agent') return 'test-agent'
        if (name === 'x-real-ip') return '127.0.0.1'
        return undefined
      })

      // 用户不存在
      mockContext.db.__setMockData(
        'SELECT * FROM users WHERE id = ?:first',
        null,
      )

      vi.mocked(jwtUtils.secureJWT.verifyToken).mockResolvedValue(mockPayload)

      const next = vi.fn()

      await expect(
        authMiddleware({
          ctx: mockContext,
          next,
          path: 'protected.test',
          type: 'mutation',
        }),
      ).rejects.toThrow(TRPCError)

      expect(next).not.toHaveBeenCalled()
    })

    it('应该在用户被禁用时抛出错误', async () => {
      const disabledUser = createTestUser({ status: 'banned' })
      const mockPayload = {
        sub: disabledUser.id,
        scope: ['read'],
        jti: 'jwt-id',
      }

      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'authorization') return 'Bearer valid_token'
        if (name === 'x-client-fingerprint') return 'fingerprint'
        if (name === 'user-agent') return 'test-agent'
        if (name === 'x-real-ip') return '127.0.0.1'
        return undefined
      })

      mockContext.db.__setMockData(
        'SELECT * FROM users WHERE id = ?:first',
        disabledUser,
      )

      vi.mocked(jwtUtils.secureJWT.verifyToken).mockResolvedValue(mockPayload)

      const next = vi.fn()

      await expect(
        authMiddleware({
          ctx: mockContext,
          next,
          path: 'protected.test',
          type: 'mutation',
        }),
      ).rejects.toThrow(TRPCError)

      expect(next).not.toHaveBeenCalled()
    })
  })
})
```

### Procedures 功能测试

#### 用户认证 Procedures 测试

```typescript
// src/trpc/__tests__/routers/auth.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { authRouter } from '../../routers/auth'
import {
  createTestTRPC,
  createMockContext,
  createTestUser,
} from '../test-utils'
import * as passwordUtils from '../../../utils/password'
import * as jwtUtils from '../../../utils/jwt-security'

// Mock 外部依赖
vi.mock('../../../utils/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('../../../utils/jwt-security', () => ({
  secureJWT: {
    signToken: vi.fn(),
  },
}))

describe('Auth Router', () => {
  const t = createTestTRPC()
  let mockContext: any
  let authProcedures: any

  beforeEach(() => {
    mockContext = createMockContext()
    authProcedures = authRouter
    vi.clearAllMocks()
  })

  describe('register', () => {
    const validRegisterInput = {
      phone: '13800138000',
      username: 'testuser',
      password: 'Password123!',
    }

    it('应该成功注册新用户', async () => {
      const hashedPassword = 'hashed_password'
      const newUser = createTestUser({
        phone: validRegisterInput.phone,
        username: validRegisterInput.username,
        password_hash: hashedPassword,
      })

      // Mock 手机号不存在检查
      mockContext.db.__setMockData(
        'SELECT id FROM users WHERE phone = ?:first',
        null,
      )

      // Mock 密码哈希
      vi.mocked(passwordUtils.hashPassword).mockResolvedValue(hashedPassword)

      // Mock 用户创建
      mockContext.db.__setMockData(
        'INSERT INTO users (id, phone, username, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?):first',
        newUser,
      )

      const result = await authProcedures.register({
        input: validRegisterInput,
        ctx: mockContext,
      })

      expect(result).toEqual({
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          phone: newUser.phone,
        },
      })

      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(
        validRegisterInput.password,
      )
    })

    it('应该在手机号已存在时抛出错误', async () => {
      const existingUser = createTestUser()

      // Mock 手机号已存在
      mockContext.db.__setMockData(
        'SELECT id FROM users WHERE phone = ?:first',
        existingUser,
      )

      await expect(
        authProcedures.register({
          input: validRegisterInput,
          ctx: mockContext,
        }),
      ).rejects.toThrow('手机号已被注册')

      expect(passwordUtils.hashPassword).not.toHaveBeenCalled()
    })

    it('应该验证输入数据格式', async () => {
      const invalidInputs = [
        { ...validRegisterInput, phone: '12345' }, // 无效手机号
        { ...validRegisterInput, username: '' }, // 空用户名
        { ...validRegisterInput, password: '123' }, // 弱密码
      ]

      for (const invalidInput of invalidInputs) {
        await expect(
          authProcedures.register({
            input: invalidInput,
            ctx: mockContext,
          }),
        ).rejects.toThrow()
      }
    })
  })

  describe('login', () => {
    const validLoginInput = {
      phone: '13800138000',
      password: 'Password123!',
    }

    it('应该成功登录并返回 Token', async () => {
      const testUser = createTestUser({
        phone: validLoginInput.phone,
        password_hash: 'hashed_password',
      })

      const mockTokenData = {
        token: 'jwt_token',
        fingerprint: 'client_fingerprint',
        jti: 'jwt_id',
      }

      // Mock 用户查询
      mockContext.db.__setMockData(
        'SELECT id, username, password_hash, status FROM users WHERE phone = ?:first',
        testUser,
      )

      // Mock 密码验证
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true)

      // Mock JWT 签发
      vi.mocked(jwtUtils.secureJWT.signToken).mockResolvedValue(mockTokenData)

      // Mock 请求头
      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'user-agent') return 'test-agent'
        if (name === 'x-real-ip') return '127.0.0.1'
        return undefined
      })

      const result = await authProcedures.login({
        input: validLoginInput,
        ctx: mockContext,
      })

      expect(result).toEqual({
        user: {
          id: testUser.id,
          username: testUser.username,
        },
        token: mockTokenData.token,
        fingerprint: mockTokenData.fingerprint,
        expiresAt: expect.any(Number),
      })

      expect(passwordUtils.verifyPassword).toHaveBeenCalledWith(
        validLoginInput.password,
        testUser.password_hash,
      )
      expect(jwtUtils.secureJWT.signToken).toHaveBeenCalledWith(
        testUser.id,
        ['read', 'write'],
        'test-agent',
        '127.0.0.1',
        60,
      )
    })

    it('应该在用户不存在时抛出错误', async () => {
      // Mock 用户不存在
      mockContext.db.__setMockData(
        'SELECT id, username, password_hash, status FROM users WHERE phone = ?:first',
        null,
      )

      await expect(
        authProcedures.login({
          input: validLoginInput,
          ctx: mockContext,
        }),
      ).rejects.toThrow('手机号或密码错误')

      expect(passwordUtils.verifyPassword).not.toHaveBeenCalled()
      expect(jwtUtils.secureJWT.signToken).not.toHaveBeenCalled()
    })

    it('应该在密码错误时抛出错误', async () => {
      const testUser = createTestUser({
        phone: validLoginInput.phone,
        password_hash: 'hashed_password',
      })

      // Mock 用户存在
      mockContext.db.__setMockData(
        'SELECT id, username, password_hash, status FROM users WHERE phone = ?:first',
        testUser,
      )

      // Mock 密码验证失败
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false)

      await expect(
        authProcedures.login({
          input: validLoginInput,
          ctx: mockContext,
        }),
      ).rejects.toThrow('手机号或密码错误')

      expect(jwtUtils.secureJWT.signToken).not.toHaveBeenCalled()
    })

    it('应该在用户被禁用时抛出错误', async () => {
      const bannedUser = createTestUser({
        phone: validLoginInput.phone,
        status: 'banned',
      })

      // Mock 被禁用的用户
      mockContext.db.__setMockData(
        'SELECT id, username, password_hash, status FROM users WHERE phone = ?:first',
        bannedUser,
      )

      // Mock 密码验证通过
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true)

      await expect(
        authProcedures.login({
          input: validLoginInput,
          ctx: mockContext,
        }),
      ).rejects.toThrow('账户已被禁用')

      expect(jwtUtils.secureJWT.signToken).not.toHaveBeenCalled()
    })
  })

  describe('refreshToken', () => {
    it('应该成功刷新 Token', async () => {
      const authenticatedUser = {
        id: 'user-1',
        username: 'testuser',
        scope: ['read', 'write'],
      }

      // Mock 已认证的上下文
      mockContext.user = authenticatedUser
      mockContext.req.header = vi.fn((name: string) => {
        if (name === 'user-agent') return 'test-agent'
        if (name === 'x-real-ip') return '127.0.0.1'
        return undefined
      })

      const mockTokenData = {
        token: 'new_jwt_token',
        fingerprint: 'new_fingerprint',
        jti: 'new_jwt_id',
      }

      vi.mocked(jwtUtils.secureJWT.signToken).mockResolvedValue(mockTokenData)

      const result = await authProcedures.refreshToken({
        ctx: mockContext,
      })

      expect(result).toEqual({
        token: mockTokenData.token,
        fingerprint: mockTokenData.fingerprint,
      })

      expect(jwtUtils.secureJWT.signToken).toHaveBeenCalledWith(
        authenticatedUser.id,
        authenticatedUser.scope,
        'test-agent',
        '127.0.0.1',
        60,
      )
    })
  })
})
```

### 文章管理 Procedures 测试

#### 文章 CRUD 测试

```typescript
// src/trpc/__tests__/routers/articles.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { articlesRouter } from '../../routers/articles'
import {
  createMockContext,
  createTestUser,
  createTestArticle,
} from '../test-utils'

describe('Articles Router', () => {
  let mockContext: any
  let authenticatedContext: any

  beforeEach(() => {
    mockContext = createMockContext()
    authenticatedContext = createMockContext({
      user: {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        scope: ['read', 'write'],
      },
    })
    vi.clearAllMocks()
  })

  describe('getList', () => {
    it('应该返回已发布文章列表', async () => {
      const testArticles = [
        createTestArticle({ id: 'article-1', title: '文章1' }),
        createTestArticle({ id: 'article-2', title: '文章2' }),
      ]

      // Mock 文章查询
      mockContext.db.__setMockData(
        'SELECT a.id, a.title, a.summary, a.cover, a.published_at, a.view_count, a.like_count, u.id as author_id, u.username as author_name, u.avatar as author_avatar FROM articles a JOIN users u ON a.author_id = u.id WHERE a.status = ? ORDER BY a.published_at DESC LIMIT ? OFFSET ?:all',
        testArticles,
      )

      // Mock 总数查询
      mockContext.db.__setMockData(
        'SELECT COUNT(*) as count FROM articles WHERE status = ?:first',
        { count: 2 },
      )

      const result = await articlesRouter.getList({
        input: { page: 1, limit: 20, status: 'published' },
        ctx: mockContext,
      })

      expect(result).toEqual({
        articles: testArticles,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      })
    })

    it('应该支持分页查询', async () => {
      const testArticles = [createTestArticle()]

      mockContext.db.__setMockData(
        'SELECT a.id, a.title, a.summary, a.cover, a.published_at, a.view_count, a.like_count, u.id as author_id, u.username as author_name, u.avatar as author_avatar FROM articles a JOIN users u ON a.author_id = u.id WHERE a.status = ? ORDER BY a.published_at DESC LIMIT ? OFFSET ?:all',
        testArticles,
      )

      mockContext.db.__setMockData(
        'SELECT COUNT(*) as count FROM articles WHERE status = ?:first',
        { count: 100 },
      )

      const result = await articlesRouter.getList({
        input: { page: 2, limit: 10, status: 'published' },
        ctx: mockContext,
      })

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 100,
        totalPages: 10,
      })
    })

    it('应该支持按作者筛选', async () => {
      const testArticles = [createTestArticle({ author_id: 'user-1' })]

      mockContext.db.__setMockData(
        'SELECT a.id, a.title, a.summary, a.cover, a.published_at, a.view_count, a.like_count, u.id as author_id, u.username as author_name, u.avatar as author_avatar FROM articles a JOIN users u ON a.author_id = u.id WHERE a.status = ? AND a.author_id = ? ORDER BY a.published_at DESC LIMIT ? OFFSET ?:all',
        testArticles,
      )

      mockContext.db.__setMockData(
        'SELECT COUNT(*) as count FROM articles WHERE status = ? AND author_id = ?:first',
        { count: 1 },
      )

      await articlesRouter.getList({
        input: {
          page: 1,
          limit: 20,
          status: 'published',
          authorId: 'user-1',
        },
        ctx: mockContext,
      })

      // 验证查询参数
      const prepareSpy = vi.spyOn(mockContext.db, 'prepare')
      expect(prepareSpy).toHaveBeenCalledWith(
        expect.stringContaining('AND a.author_id = ?'),
      )
    })
  })

  describe('getById', () => {
    it('应该返回指定文章详情', async () => {
      const testArticle = createTestArticle()

      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ? AND status = "published":first',
        testArticle,
      )

      const result = await articlesRouter.getById({
        input: { id: testArticle.id },
        ctx: mockContext,
      })

      expect(result).toEqual(testArticle)
    })

    it('应该在文章不存在时抛出错误', async () => {
      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ? AND status = "published":first',
        null,
      )

      await expect(
        articlesRouter.getById({
          input: { id: 'non-existent' },
          ctx: mockContext,
        }),
      ).rejects.toThrow('文章不存在')
    })
  })

  describe('create', () => {
    const validCreateInput = {
      title: '新文章标题',
      content: '文章内容',
      summary: '文章摘要',
    }

    it('应该成功创建新文章', async () => {
      const createdArticle = createTestArticle({
        ...validCreateInput,
        author_id: authenticatedContext.user.id,
        status: 'draft',
      })

      // Mock 文章创建
      mockContext.db.__setMockData(
        "INSERT INTO articles (id, title, content, summary, author_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'draft', ?):first",
        createdArticle,
      )

      const result = await articlesRouter.create({
        input: validCreateInput,
        ctx: authenticatedContext,
      })

      expect(result).toMatchObject({
        id: expect.any(String),
        title: validCreateInput.title,
        content: validCreateInput.content,
        summary: validCreateInput.summary,
      })
    })

    it('应该在未认证时抛出错误', async () => {
      await expect(
        articlesRouter.create({
          input: validCreateInput,
          ctx: mockContext,
        }),
      ).rejects.toThrow('请先登录')
    })

    it('应该验证输入数据', async () => {
      const invalidInputs = [
        { ...validCreateInput, title: '' }, // 空标题
        { ...validCreateInput, content: '' }, // 空内容
        {
          ...validCreateInput,
          title: 'a'.repeat(201), // 标题过长
        },
      ]

      for (const invalidInput of invalidInputs) {
        await expect(
          articlesRouter.create({
            input: invalidInput,
            ctx: authenticatedContext,
          }),
        ).rejects.toThrow()
      }
    })
  })

  describe('update', () => {
    const validUpdateInput = {
      id: 'article-1',
      title: '更新后的标题',
      content: '更新后的内容',
    }

    it('应该成功更新自己的文章', async () => {
      const existingArticle = createTestArticle({
        id: validUpdateInput.id,
        author_id: authenticatedContext.user.id,
      })

      // Mock 文章查询
      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ?:first',
        existingArticle,
      )

      const updatedArticle = {
        ...existingArticle,
        ...validUpdateInput,
      }

      // Mock 文章更新
      mockContext.db.__setMockData(
        'UPDATE articles SET title = ?, content = ?, updated_at = ? WHERE id = ?:first',
        updatedArticle,
      )

      const result = await articlesRouter.update({
        input: validUpdateInput,
        ctx: authenticatedContext,
      })

      expect(result).toMatchObject(validUpdateInput)
    })

    it('应该在文章不存在时抛出错误', async () => {
      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ?:first',
        null,
      )

      await expect(
        articlesRouter.update({
          input: validUpdateInput,
          ctx: authenticatedContext,
        }),
      ).rejects.toThrow('文章不存在')
    })

    it('应该在尝试更新他人文章时抛出错误', async () => {
      const otherUserArticle = createTestArticle({
        id: validUpdateInput.id,
        author_id: 'other-user',
      })

      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ?:first',
        otherUserArticle,
      )

      await expect(
        articlesRouter.update({
          input: validUpdateInput,
          ctx: authenticatedContext,
        }),
      ).rejects.toThrow('无权修改此文章')
    })
  })

  describe('delete', () => {
    it('应该成功删除自己的文章', async () => {
      const testArticle = createTestArticle({
        author_id: authenticatedContext.user.id,
      })

      // Mock 文章查询
      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ?:first',
        testArticle,
      )

      const result = await articlesRouter.delete({
        input: { id: testArticle.id },
        ctx: authenticatedContext,
      })

      expect(result).toEqual({ success: true })
    })

    it('应该在文章不存在时抛出错误', async () => {
      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ?:first',
        null,
      )

      await expect(
        articlesRouter.delete({
          input: { id: 'non-existent' },
          ctx: authenticatedContext,
        }),
      ).rejects.toThrow('文章不存在')
    })

    it('应该在尝试删除他人文章时抛出错误', async () => {
      const otherUserArticle = createTestArticle({
        author_id: 'other-user',
      })

      mockContext.db.__setMockData(
        'SELECT * FROM articles WHERE id = ?:first',
        otherUserArticle,
      )

      await expect(
        articlesRouter.delete({
          input: { id: otherUserArticle.id },
          ctx: authenticatedContext,
        }),
      ).rejects.toThrow('无权删除此文章')
    })
  })
})
```

### 数据验证逻辑测试

#### Zod Schema 验证测试

```typescript
// src/utils/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validators } from '../input-validation'

describe('Input Validation', () => {
  describe('phoneSchema', () => {
    it('应该验证有效的手机号', () => {
      const validPhones = ['13800138000', '15912345678', '18612345678']

      validPhones.forEach(phone => {
        expect(() => validators.phoneSchema.parse(phone)).not.toThrow()
      })
    })

    it('应该拒绝无效的手机号', () => {
      const invalidPhones = [
        '12345678901', // 错误开头
        '1380013800', // 位数不足
        '138001380001', // 位数过多
        'abc12345678', // 包含字母
        '138-0013-8000', // 包含特殊字符
      ]

      invalidPhones.forEach(phone => {
        expect(() => validators.phoneSchema.parse(phone)).toThrow()
      })
    })

    it('应该去除手机号中的空格', () => {
      const phoneWithSpaces = '138 0013 8000'
      const result = validators.phoneSchema.parse(phoneWithSpaces)
      expect(result).toBe('13800138000')
    })
  })

  describe('passwordSchema', () => {
    it('应该验证强密码', () => {
      const strongPasswords = [
        'Password123!',
        'MySecure@Pass1',
        'Strong#Password9',
      ]

      strongPasswords.forEach(password => {
        expect(() => validators.passwordSchema.parse(password)).not.toThrow()
      })
    })

    it('应该拒绝弱密码', () => {
      const weakPasswords = [
        'password', // 缺少大写字母、数字、特殊字符
        'PASSWORD', // 缺少小写字母、数字、特殊字符
        'Password', // 缺少数字、特殊字符
        'Pass123', // 长度不足
        'password123', // 常见弱密码
        'a'.repeat(129), // 超长
      ]

      weakPasswords.forEach(password => {
        expect(() => validators.passwordSchema.parse(password)).toThrow()
      })
    })

    it('应该检查密码复杂性要求', () => {
      const tests = [
        { password: 'password123!', error: '密码必须包含大写字母' },
        { password: 'PASSWORD123!', error: '密码必须包含小写字母' },
        { password: 'Password!', error: '密码必须包含数字' },
        { password: 'Password123', error: '密码必须包含特殊字符' },
        { password: 'Pass!1', error: '密码至少8位' },
      ]

      tests.forEach(({ password, error }) => {
        expect(() => validators.passwordSchema.parse(password)).toThrow(
          expect.stringContaining(error),
        )
      })
    })
  })

  describe('usernameSchema', () => {
    it('应该验证有效的用户名', () => {
      const validUsernames = [
        'testuser',
        'user123',
        'test_user',
        '测试用户',
        'user测试',
      ]

      validUsernames.forEach(username => {
        expect(() => validators.usernameSchema.parse(username)).not.toThrow()
      })
    })

    it('应该拒绝无效的用户名', () => {
      const invalidUsernames = [
        'a', // 太短
        'a'.repeat(21), // 太长
        'test-user', // 包含连字符
        'test user', // 包含空格
        'test@user', // 包含特殊字符
        '<script>', // 潜在的 XSS
      ]

      invalidUsernames.forEach(username => {
        expect(() => validators.usernameSchema.parse(username)).toThrow()
      })
    })

    it('应该清理潜在的 XSS 内容', () => {
      const maliciousInput = 'user<script>alert("xss")</script>'
      const result = validators.usernameSchema.parse(maliciousInput)
      expect(result).not.toContain('<script>')
    })
  })

  describe('emailSchema', () => {
    it('应该验证有效的邮箱', () => {
      const validEmails = [
        'test@example.com',
        'user.test@domain.co.uk',
        'user+tag@example.org',
      ]

      validEmails.forEach(email => {
        expect(() => validators.emailSchema.parse(email)).not.toThrow()
      })
    })

    it('应该拒绝无效的邮箱', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'a'.repeat(250) + '@example.com', // 过长
      ]

      invalidEmails.forEach(email => {
        expect(() => validators.emailSchema.parse(email)).toThrow()
      })
    })

    it('应该转换为小写并去除空格', () => {
      const messyEmail = '  TEST@EXAMPLE.COM  '
      const result = validators.emailSchema.parse(messyEmail)
      expect(result).toBe('test@example.com')
    })
  })

  describe('htmlContentSchema', () => {
    it('应该清理危险的 HTML 标签', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>'
      const result = validators.htmlContentSchema.parse(maliciousHtml)

      expect(result).not.toContain('<script>')
      expect(result).toContain('<p>Safe content</p>')
    })

    it('应该保留安全的 HTML 标签', () => {
      const safeHtml = '<p>段落</p><strong>加粗</strong><em>斜体</em>'
      const result = validators.htmlContentSchema.parse(safeHtml)

      expect(result).toBe(safeHtml)
    })

    it('应该拒绝过长的内容', () => {
      const longContent = '<p>' + 'a'.repeat(50000) + '</p>'

      expect(() => validators.htmlContentSchema.parse(longContent)).toThrow(
        '内容过长',
      )
    })
  })

  describe('urlSchema', () => {
    it('应该验证有效的 URL', () => {
      const validUrls = [
        'https://example.com',
        'http://test.org/path',
        'https://subdomain.example.com/path?query=value',
      ]

      validUrls.forEach(url => {
        expect(() => validators.urlSchema.parse(url)).not.toThrow()
      })
    })

    it('应该拒绝无效的协议', () => {
      const invalidUrls = [
        'ftp://example.com',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
      ]

      invalidUrls.forEach(url => {
        expect(() => validators.urlSchema.parse(url)).toThrow()
      })
    })

    it('应该拒绝内网地址', () => {
      const intranetUrls = [
        'http://192.168.1.1',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'http://127.0.0.1',
        'http://localhost',
      ]

      intranetUrls.forEach(url => {
        expect(() => validators.urlSchema.parse(url)).toThrow(
          '不允许访问内网地址',
        )
      })
    })
  })
})
```

## 🛠️ 实践操作

### 步骤1：配置测试环境

```bash
# 安装测试相关依赖
npm install -D vitest @vitest/ui c8
npm install -D msw msw-trpc
npm install -D @types/supertest

# 创建测试配置
mkdir -p src/trpc/__tests__
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // 关键模块要求更高覆盖率
        'src/trpc/routers/auth.ts': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 步骤2：建立测试脚本

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:auth": "vitest run src/trpc/__tests__/routers/auth.test.ts",
    "test:articles": "vitest run src/trpc/__tests__/routers/articles.test.ts",
    "test:validation": "vitest run src/utils/__tests__/validation.test.ts"
  }
}
```

### 步骤3：设置测试数据库

```sql
-- test-schema.sql
-- 测试用的简化表结构
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  role TEXT DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  cover TEXT,
  status TEXT DEFAULT 'draft',
  author_id TEXT NOT NULL,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (author_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  article_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  parent_id TEXT,
  status TEXT DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (parent_id) REFERENCES comments (id)
);
```

## 🔍 深入思考

### 测试策略的关键原则

1. **隔离性**：每个测试应该独立运行，不依赖其他测试
2. **确定性**：相同的测试在相同条件下应该产生相同结果
3. **快速反馈**：测试应该快速运行，提供即时反馈
4. **可维护性**：测试代码应该清晰、简洁、易于维护

### 测试覆盖率的平衡

```typescript
// 测试覆盖率策略
const coverageStrategy = {
  // 核心业务逻辑 - 要求高覆盖率
  critical: {
    paths: ['src/trpc/routers', 'src/middleware'],
    threshold: 95,
  },

  // 工具函数 - 要求中等覆盖率
  utilities: {
    paths: ['src/utils'],
    threshold: 85,
  },

  // 类型定义和配置 - 可以较低覆盖率
  infrastructure: {
    paths: ['src/types', 'src/config'],
    threshold: 60,
  },
}
```

## ❓ 遇到的问题

### 问题 1：Mock 数据库交互复杂

**问题描述**：D1 数据库的 Mock 实现复杂，难以准确模拟  
**解决方案**：

```typescript
// 创建更真实的 Mock 数据库
class MockD1Database {
  private data = new Map<string, any[]>()

  prepare(sql: string) {
    return {
      bind: (...params: any[]) => ({
        first: () => this.executeQuery(sql, params, 'first'),
        all: () => ({ results: this.executeQuery(sql, params, 'all') }),
        run: () => this.executeCommand(sql, params),
      }),
    }
  }

  private executeQuery(sql: string, params: any[], mode: 'first' | 'all') {
    // 简化的 SQL 解析和执行逻辑
    // 实际项目中可以使用 sql.js 或其他内存数据库
  }
}
```

### 问题 2：异步测试难以控制

**问题描述**：异步操作的测试时序难以控制  
**解决方案**：使用 `vi.waitFor` 和 `flushPromises`

### 问题 3：测试运行时间过长

**问题描述**：大量测试导致反馈循环变慢  
**解决方案**：

- 并行运行测试
- 使用测试标签分组
- 优化 Mock 对象创建

## 💡 个人心得

### 今天最大的收获

深入理解了测试驱动开发的价值，学会了如何为 tRPC API 编写全面的单元测试。

### 单元测试的核心价值

1. **质量保证**：确保代码按预期工作
2. **文档作用**：测试即文档，展示 API 用法
3. **重构安全**：为代码重构提供安全网
4. **设计改进**：促使编写更好的 API 设计

## 📋 行动清单

### 今日完成

- [x] 建立 tRPC procedures 测试框架
- [x] 编写认证系统的完整单元测试
- [x] 实现文章管理功能的测试用例
- [x] 创建数据验证逻辑的测试套件

### 明日预习

- [ ] 了解生产环境部署策略
- [ ] 思考 CI/CD 流水线配置
- [ ] 准备 Cloudflare Workers 部署方案

## 🔗 有用链接

- [Vitest 官方文档](https://vitest.dev/)
- [MSW (Mock Service Worker)](https://mswjs.io/)
- [tRPC 测试指南](https://trpc.io/docs/testing)
- [测试最佳实践](https://kentcdodds.com/blog/write-tests)

---

**📝 明日重点**：配置生产环境部署，建立 CI/CD 自动化流水线。
