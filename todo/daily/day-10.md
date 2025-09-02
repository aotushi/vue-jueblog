# Day 10: 搭建 tRPC 基础架构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建 tRPC 根 router 配置
- [ ] 设置 tRPC 上下文 (Context)
- [ ] 配置 JWT 中间件（迁移现有认证逻辑）
- [ ] 创建第一个测试 procedure

## 📚 学习笔记

### tRPC 基础架构设计

#### tRPC 核心概念回顾

```typescript
Router → Procedure → Input/Output → Context → Middleware
  ↓         ↓           ↓             ↓         ↓
路由树   → API方法  → 数据验证    → 运行环境  → 认证/日志
```

#### 项目目录结构

```
vue-blog-backend/src/
├── index.ts                # Hono 应用入口
├── trpc/
│   ├── router.ts          # 根路由配置
│   ├── context.ts         # tRPC 上下文
│   ├── middleware.ts      # tRPC 中间件
│   ├── users.ts           # 用户相关 procedures
│   ├── articles.ts        # 文章相关 procedures
│   └── comments.ts        # 评论相关 procedures
└── utils/
    ├── jwt.ts             # JWT 工具
    └── crypto.ts          # 加密工具
```

## 🛠️ 实践操作

### 步骤1：创建 tRPC 上下文

```typescript
// src/trpc/context.ts
import { inferAsyncReturnType } from '@trpc/server'
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import jwt from '@hono/jwt'

export interface User {
  id: string
  username: string
  phone: string
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
  env: Env,
) {
  const { req } = opts

  // 从请求头中获取 token
  const authorization = req.headers.get('authorization')
  const token = authorization?.replace('Bearer ', '')

  let user: User | null = null

  // 验证 JWT token
  if (token) {
    try {
      const payload = await jwt.verify(token, env.JWT_SECRET)
      user = payload as User
    } catch (error) {
      // Token 无效，用户为空
      console.warn('Invalid JWT token:', error)
    }
  }

  return {
    req,
    env,
    user,
    // 数据库连接
    db: env.DB,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
```

### 步骤2：创建 tRPC 中间件

```typescript
// src/trpc/middleware.ts
import { TRPCError } from '@trpc/server'
import { middleware } from './router'

// 认证中间件
export const isAuthenticated = middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // 确保 user 存在
    },
  })
})

// 日志中间件
export const logging = middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start

  console.log(`${type} ${path} took ${durationMs}ms`)

  return result
})

// 错误处理中间件
export const errorHandler = middleware(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    console.error('tRPC Error:', error)

    // 根据环境返回不同的错误信息
    if (process.env.NODE_ENV === 'development') {
      throw error
    }

    // 生产环境隐藏详细错误
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
    })
  }
})
```

### 步骤3：创建根路由配置

```typescript
// src/trpc/router.ts
import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'
import type { Context } from './context'
import { logging, errorHandler } from './middleware'

// 初始化 tRPC
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

// 导出路由构建器
export const router = t.router
export const middleware = t.middleware

// 公共 procedure (无需认证)
export const publicProcedure = t.procedure.use(logging).use(errorHandler)

// 需要认证的 procedure
export const protectedProcedure = publicProcedure.use(isAuthenticated)

// 根路由 - 组合所有子路由
import { userRouter } from './users'
import { articleRouter } from './articles'
import { commentRouter } from './comments'

export const appRouter = router({
  users: userRouter,
  articles: articleRouter,
  comments: commentRouter,

  // 健康检查
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }),
})

export type AppRouter = typeof appRouter
```

### 步骤4：创建用户相关 procedures

```typescript
// src/trpc/users.ts
import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from './router'
import { TRPCError } from '@trpc/server'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { generateJWT } from '../utils/jwt'

// 输入验证 Schema
const LoginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  password: z.string().min(6, '密码至少6位'),
})

const RegisterSchema = LoginSchema.extend({
  username: z
    .string()
    .min(2, '用户名至少2个字符')
    .max(20, '用户名不超过20个字符'),
})

export const userRouter = router({
  // 用户注册
  register: publicProcedure
    .input(RegisterSchema)
    .mutation(async ({ input, ctx }) => {
      const { phone, password, username } = input

      // 检查手机号是否已存在
      const existingUser = await ctx.db
        .prepare('SELECT id FROM users WHERE phone = ?')
        .bind(phone)
        .first()

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '手机号已被注册',
        })
      }

      // 创建新用户
      const userId = crypto.randomUUID()
      const hashedPassword = await hashPassword(password)

      await ctx.db
        .prepare(
          `
          INSERT INTO users (id, phone, username, password, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
        )
        .bind(userId, phone, username, hashedPassword)
        .run()

      // 生成 JWT token
      const token = await generateJWT(
        {
          id: userId,
          username,
          phone,
        },
        ctx.env.JWT_SECRET,
      )

      return {
        message: '注册成功',
        token,
        user: {
          id: userId,
          username,
          phone,
        },
      }
    }),

  // 用户登录
  login: publicProcedure.input(LoginSchema).mutation(async ({ input, ctx }) => {
    const { phone, password } = input

    // 查找用户
    const user = await ctx.db
      .prepare('SELECT * FROM users WHERE phone = ?')
      .bind(phone)
      .first()

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '用户不存在',
      })
    }

    // 验证密码
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '密码错误',
      })
    }

    // 生成 JWT token
    const token = await generateJWT(
      {
        id: user.id,
        username: user.username,
        phone: user.phone,
      },
      ctx.env.JWT_SECRET,
    )

    return {
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        avatar: user.avatar || '',
      },
    }
  }),

  // 获取当前用户信息
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(ctx.user.id)
      .first()

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '用户不存在',
      })
    }

    // 不返回密码
    const { password, ...userInfo } = user
    return userInfo
  }),

  // 测试 procedure
  hello: publicProcedure.input(z.string().optional()).query(({ input }) => {
    return {
      message: `Hello ${input ?? 'World'}!`,
      timestamp: new Date().toISOString(),
    }
  }),
})
```

### 步骤5：集成到 Hono 应用

```typescript
// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { appRouter } from './trpc/router'
import { createContext } from './trpc/context'

type Env = {
  DB: D1Database
  JWT_SECRET: string
  NODE_ENV: string
}

const app = new Hono<{ Bindings: Env }>()

// CORS 中间件
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://yourdomain.com'],
    credentials: true,
  }),
)

// tRPC 服务器
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (opts, c) => createContext(opts, c.env),
  }),
)

// 健康检查
app.get('/', c => {
  return c.json({
    message: 'Vue Blog Backend API',
    version: '2.0.0',
    environment: c.env.NODE_ENV,
  })
})

// 404 处理
app.notFound(c => {
  return c.json({ error: 'Not Found' }, 404)
})

export default app
```

### 步骤6：创建工具函数

```typescript
// src/utils/crypto.ts
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const hashedInput = await hashPassword(password)
  return hashedInput === hash
}

// src/utils/jwt.ts
export async function generateJWT(
  payload: any,
  secret: string,
): Promise<string> {
  // 简化版 JWT 实现，生产环境建议使用成熟的库
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)

  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 天过期
  }

  // 这里简化处理，实际应该使用标准 JWT 库
  return `jwt-token-${payload.id}-${now}`
}
```

## 🔍 测试 tRPC API

### 本地测试

```bash
# 启动开发服务器
wrangler dev

# 测试健康检查
curl http://localhost:8787/trpc/health

# 测试 hello procedure
curl -X POST http://localhost:8787/trpc/users.hello \
  -H "Content-Type: application/json" \
  -d '{"input":"Vue Blog"}'
```

### 类型安全验证

```typescript
// 前端使用示例 (下次配置)
const result = await trpc.users.hello.query('Vue Blog')
//    ↑ result 类型自动推断为 { message: string, timestamp: string }

const user = await trpc.users.login.mutate({
  phone: '13888888888',
  password: '123456',
})
//    ↑ 输入参数类型检查，返回类型自动推断
```

## ❓ 遇到的问题

### 问题 1：tRPC 上下文类型推断

**问题描述**：Context 类型推断复杂，IDE 提示不准确  
**解决方案**：使用 `inferAsyncReturnType` 正确推断类型

### 问题 2：JWT 在 Workers 环境的实现

**问题描述**：标准 JWT 库在 Workers 环境兼容性问题  
**解决方案**：使用 Web Crypto API 或 Workers 兼容的 JWT 库

## 💡 个人心得

### 今天最大的收获

成功搭建了 tRPC 的基础架构，理解了从路由设计到中间件配置的完整流程。

### tRPC 的优势体验

1. **类型安全**：编译期就能发现 API 调用错误
2. **开发效率**：无需手动维护接口文档
3. **重构友好**：修改后端接口，前端自动更新

## 📋 行动清单

### 今日完成

- [ ] tRPC 根路由和上下文配置
- [ ] JWT 认证中间件实现
- [ ] 用户注册登录 procedures
- [ ] 与 Hono 的完整集成

### 明日预习

- [ ] 设计数据库表结构的详细 Schema
- [ ] 了解 SQL 索引优化策略

## 🔗 有用链接

- [tRPC 服务端文档](https://trpc.io/docs/server/introduction)
- [Hono + tRPC 集成](https://hono.dev/middleware/third-party/trpc-server)
- [Zod 验证库](https://zod.dev/)

---

**📝 明日重点**：设计完整的数据库表结构，为数据迁移做准备。
