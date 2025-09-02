# Day 2: Hono 框架入门

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 阅读 [Hono 官方文档](https://hono.dev/) 基础部分
- [ ] 了解 Hono 相比 Express 的优势
- [ ] 学习 Hono 的中间件系统
- [ ] 创建一个简单的 Hello World Hono 应用

## 📚 学习笔记

### Hono 框架概述

#### 什么是 Hono？

```
Hono = 炎 (日语中的"火焰"之意)
- 专为 Cloudflare Workers/Edge Runtime 设计
- 极小的包体积 (~12KB)
- 无依赖，启动速度极快
- 支持多种运行环境 (Workers, Deno, Node.js)
```

#### Hono vs Express 对比

| 特性       | Express    | Hono       |
| ---------- | ---------- | ---------- |
| 包大小     | ~500KB     | ~12KB      |
| 冷启动     | 慢         | 极快       |
| 边缘计算   | 不支持     | 专门优化   |
| 中间件生态 | 丰富       | 精简但足够 |
| TypeScript | 需要@types | 原生支持   |

### 基础代码示例

#### 创建 Hello World 应用

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', c => {
  return c.text('Hello Hono!')
})

app.get('/api/users/:id', c => {
  const id = c.req.param('id')
  return c.json({ id, name: 'John Doe' })
})

export default app
```

#### 中间件使用

```typescript
// 自定义中间件
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`)
  await next()
})

// CORS 中间件
import { cors } from 'hono/cors'
app.use('*', cors())

// JWT 认证中间件
import { jwt } from 'hono/jwt'
app.use(
  '/protected/*',
  jwt({
    secret: 'your-secret-key',
  }),
)
```

## 🔍 深入思考

### Hono 的核心优势

1. **性能优势**

   - 专为 V8 Engine 优化
   - 无 Node.js 依赖，减少启动开销
   - 适合 Serverless 冷启动场景

2. **开发体验**

   - 原生 TypeScript 支持
   - 简洁的 API 设计
   - 与 Express 相似的语法，学习成本低

3. **边缘计算友好**
   - 支持 Cloudflare Workers
   - 支持 Deno Deploy
   - 支持 Vercel Edge Functions

### 与当前项目的集成思路

```typescript
// 当前 Express 代码
app.get('/api/users/login', async (req, res) => {
  const { phone, password } = req.body
  // ... 登录逻辑
  res.json({ code: 200, token })
})

// 迁移到 Hono
app.post('/api/users/login', async c => {
  const { phone, password } = await c.req.json()
  // ... 登录逻辑
  return c.json({ code: 200, token })
})
```

## 🛠️ 实践练习

### 创建测试应用

```bash
# 创建测试目录
mkdir hono-test && cd hono-test

# 初始化项目
npm init -y

# 安装依赖
npm install hono
npm install -D wrangler

# 创建 src/index.ts
```

```typescript
// src/index.ts 内容
import { Hono } from 'hono'

const app = new Hono()

// 基础路由
app.get('/', c => c.text('Hono Test App!'))

// JSON 响应
app.get('/api/test', c => {
  return c.json({
    message: 'Hello from Hono!',
    timestamp: new Date().toISOString(),
  })
})

// 路径参数
app.get('/api/users/:id', c => {
  const userId = c.req.param('id')
  return c.json({
    userId,
    name: `User ${userId}`,
  })
})

export default app
```

### 本地测试结果

```
测试命令：wrangler dev
测试结果：_____
遇到的问题：_____
解决方案：_____
```

## ❓ 遇到的问题

### 问题 1：Hono 与 tRPC 的集成方式

**问题描述**：如何在 Hono 中集成 tRPC？  
**解决方案**：

```typescript
import { trpcServer } from '@trpc/server/adapters/fetch'

app.use('/trpc/*', async c => {
  return trpcServer({
    router: appRouter,
    createContext: () => ({ req: c.req }),
  })(c.req.raw)
})
```

### 问题 2：

**问题描述**：**\_**  
**解决方案**：**\_**

## 🎥 参考资料

1. **[Hono 官方文档](https://hono.dev/)**

   - 核心要点：专为边缘计算设计的轻量级框架
   - 个人收获：理解了与 Express 的根本区别

2. **[Cloudflare Workers + Hono 教程]**(**\_**)
   - 核心要点：**\_**
   - 个人收获：**\_**

## 💡 个人心得

### 今天最大的收获

Hono 的设计理念很清晰：专为边缘计算而生，牺牲一些生态的丰富性，换取极致的性能和启动速度。

### 对项目升级的新理解

Express → Hono 的迁移比想象中简单，API 设计相似度很高，主要是运行环境的差异。

### 与昨天 tRPC 学习的联系

Hono + tRPC 是天作之合：Hono 提供轻量级运行时，tRPC 提供类型安全的 API 层。

## 📋 行动清单

### 今日完成

- [ ] 阅读 Hono 文档
- [ ] 创建测试应用
- [ ] 对比 Express 差异

### 明日预习

- [ ] 了解 Cloudflare Workers 部署流程
- [ ] 准备 Cloudflare 账户

## 🔗 有用链接

- [Hono 官方文档](https://hono.dev/)
- [Hono GitHub 仓库](https://github.com/honojs/hono)
- [Hono + tRPC 示例](https://github.com/honojs/hono/tree/main/examples/trpc)
- [Cloudflare Workers 与 Hono](https://hono.dev/getting-started/cloudflare-workers)

---

**📝 明日重点**：学习 Cloudflare Workers 环境，为实际部署做准备。
