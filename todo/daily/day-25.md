# Day 25: 性能优化和缓存策略

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 优化 SQL 查询性能
- [ ] 实现合理的数据库索引
- [ ] 配置 Cloudflare Workers 缓存策略
- [ ] 优化前端请求批处理

## 📚 学习笔记

### 数据库性能优化

#### D1 数据库索引策略

```sql
-- src/db/optimize-indexes.sql

-- 用户表索引优化
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 文章表索引优化
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);

-- 复合索引用于复杂查询
CREATE INDEX IF NOT EXISTS idx_articles_status_published
ON articles(status, published_at DESC)
WHERE status = 'published';

-- 全文搜索索引（如果 D1 支持）
CREATE INDEX IF NOT EXISTS idx_articles_title_fts ON articles(title);

-- 评论表索引优化
CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- 点赞表索引优化
CREATE UNIQUE INDEX IF NOT EXISTS idx_praises_unique
ON praises(user_id, target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_praises_target ON praises(target_id, target_type);

-- 关注表索引优化
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique
ON follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
```

#### SQL 查询优化技巧

```typescript
// src/trpc/optimized-queries.ts
import { z } from 'zod'
import { publicProcedure } from './trpc'

export const articlesRouter = {
  // 优化后的文章列表查询
  getArticleList: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().min(1).max(50).default(20),
        status: z.enum(['published', 'draft']).default('published'),
        authorId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.limit

      // 优化的 SQL 查询 - 利用索引
      const articles = await ctx.db
        .prepare(
          `
        SELECT 
          a.id,
          a.title,
          a.summary,
          a.cover,
          a.published_at,
          a.view_count,
          a.like_count,
          u.id as author_id,
          u.username as author_name,
          u.avatar as author_avatar
        FROM articles a
        JOIN users u ON a.author_id = u.id
        WHERE a.status = ?
        ${input.authorId ? 'AND a.author_id = ?' : ''}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `,
        )
        .bind(
          input.status,
          ...(input.authorId ? [input.authorId] : []),
          input.limit,
          offset,
        )
        .all()

      // 获取总数（优化的计数查询）
      const totalQuery = await ctx.db
        .prepare(
          `
        SELECT COUNT(*) as count 
        FROM articles 
        WHERE status = ?
        ${input.authorId ? 'AND author_id = ?' : ''}
      `,
        )
        .bind(input.status, ...(input.authorId ? [input.authorId] : []))
        .first()

      return {
        articles: articles.results,
        pagination: {
          page: input.page,
          limit: input.limit,
          total: totalQuery?.count || 0,
          totalPages: Math.ceil((totalQuery?.count || 0) / input.limit),
        },
      }
    }),
}
```

### Cloudflare Workers 缓存策略

#### 边缘缓存配置

```typescript
// src/middleware/cache.ts
import { Context, Next } from 'hono'

export const cacheMiddleware = async (c: Context, next: Next) => {
  const cacheKey = new Request(c.req.url, c.req)
  const cache = caches.default

  // 检查缓存
  let response = await cache.match(cacheKey)

  if (!response) {
    // 缓存未命中，执行请求处理
    await next()
    response = c.res.clone()

    // 根据路径设置不同的缓存策略
    const url = new URL(c.req.url)
    let cacheControl = 'no-cache'

    if (url.pathname.startsWith('/api/articles')) {
      // 文章数据缓存 5 分钟
      cacheControl = 'public, max-age=300'
    } else if (url.pathname.startsWith('/api/users/profile')) {
      // 用户资料缓存 1 小时
      cacheControl = 'public, max-age=3600'
    } else if (url.pathname.startsWith('/api/static')) {
      // 静态数据缓存 24 小时
      cacheControl = 'public, max-age=86400'
    }

    // 设置缓存头
    response.headers.set('Cache-Control', cacheControl)

    // 只缓存 GET 请求和成功响应
    if (c.req.method === 'GET' && response.status === 200) {
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
    }
  }

  return response
}

// 智能缓存失效策略
export const invalidateCache = async (pattern: string) => {
  const cache = caches.default
  const keys = await cache.keys()

  for (const key of keys) {
    if (key.url.includes(pattern)) {
      await cache.delete(key)
    }
  }
}

// 使用示例
export const articlesRouter = {
  createArticle: protectedProcedure
    .input(createArticleSchema)
    .mutation(async ({ input, ctx }) => {
      const article = await ctx.db.prepare(/* ... */).run()

      // 创建文章后，清除相关缓存
      ctx.executionCtx.waitUntil(invalidateCache('/api/articles'))

      return article
    }),
}
```

#### 应用级缓存优化

```typescript
// src/utils/memory-cache.ts
class MemoryCache {
  private cache = new Map<string, { value: any; expire: number }>()
  private readonly defaultTTL = 5 * 60 * 1000 // 5 分钟

  set(key: string, value: any, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expire: Date.now() + ttl,
    })
  }

  get(key: string) {
    const item = this.cache.get(key)

    if (!item) return null

    if (Date.now() > item.expire) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  delete(key: string) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // 定期清理过期缓存
  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache) {
      if (now > item.expire) {
        this.cache.delete(key)
      }
    }
  }
}

// 创建全局缓存实例
export const memoryCache = new MemoryCache()

// 定期清理（每5分钟）
setInterval(() => memoryCache.cleanup(), 5 * 60 * 1000)

// 使用装饰器模式的缓存
export function cached(ttl = 5 * 60 * 1000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`

      // 检查缓存
      let result = memoryCache.get(cacheKey)

      if (result === null) {
        // 执行原始方法
        result = await originalMethod.apply(this, args)
        // 缓存结果
        memoryCache.set(cacheKey, result, ttl)
      }

      return result
    }

    return descriptor
  }
}
```

### 前端请求优化

#### 请求批处理实现

```typescript
// src/utils/batch-requests.ts
class BatchRequestManager {
  private batches = new Map<
    string,
    {
      requests: Array<{ resolve: Function; reject: Function; input: any }>
      timer: NodeJS.Timeout
    }
  >()

  private readonly batchDelay = 10 // 10ms 内的请求会被批处理

  async batchRequest<T>(
    batchKey: string,
    input: any,
    executor: (inputs: any[]) => Promise<T[]>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let batch = this.batches.get(batchKey)

      if (!batch) {
        batch = {
          requests: [],
          timer: setTimeout(
            () => this.executeBatch(batchKey, executor),
            this.batchDelay,
          ),
        }
        this.batches.set(batchKey, batch)
      }

      batch.requests.push({ resolve, reject, input })
    })
  }

  private async executeBatch<T>(
    batchKey: string,
    executor: (inputs: any[]) => Promise<T[]>,
  ) {
    const batch = this.batches.get(batchKey)
    if (!batch) return

    this.batches.delete(batchKey)

    try {
      const inputs = batch.requests.map(req => req.input)
      const results = await executor(inputs)

      batch.requests.forEach((req, index) => {
        req.resolve(results[index])
      })
    } catch (error) {
      batch.requests.forEach(req => {
        req.reject(error)
      })
    }
  }
}

export const batchManager = new BatchRequestManager()

// 使用示例：批量获取用户信息
export async function getUserInfo(userId: string) {
  return batchManager.batchRequest(
    'getUserInfo',
    userId,
    async (userIds: string[]) => {
      // 一次请求获取多个用户信息
      const users = await trpc.users.getByIds.query({ ids: userIds })
      return userIds.map(id => users.find(u => u.id === id))
    },
  )
}
```

#### 前端缓存策略

```typescript
// src/composables/useQueryCache.ts
import { ref, computed } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'

export function useQueryCache() {
  const queryClient = useQueryClient()

  // 预热常用数据
  const preloadCommonData = async () => {
    await Promise.all([
      // 预加载用户信息
      queryClient.prefetchQuery({
        queryKey: ['user', 'profile'],
        queryFn: () => trpc.users.getProfile.query(),
        staleTime: 10 * 60 * 1000, // 10 分钟
      }),

      // 预加载文章列表
      queryClient.prefetchQuery({
        queryKey: ['articles', { page: 1, status: 'published' }],
        queryFn: () =>
          trpc.articles.getList.query({ page: 1, status: 'published' }),
        staleTime: 5 * 60 * 1000, // 5 分钟
      }),
    ])
  }

  // 智能缓存失效
  const invalidateRelatedQueries = (type: string, id?: string) => {
    switch (type) {
      case 'article':
        queryClient.invalidateQueries({ queryKey: ['articles'] })
        if (id) {
          queryClient.invalidateQueries({ queryKey: ['article', id] })
        }
        break

      case 'user':
        queryClient.invalidateQueries({ queryKey: ['users'] })
        if (id) {
          queryClient.invalidateQueries({ queryKey: ['user', id] })
        }
        break
    }
  }

  // 缓存统计信息
  const cacheStats = computed(() => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()

    return {
      totalQueries: queries.length,
      freshQueries: queries.filter(
        q => q.state.dataUpdatedAt > Date.now() - 5 * 60 * 1000,
      ).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.error).length,
    }
  })

  return {
    preloadCommonData,
    invalidateRelatedQueries,
    cacheStats,
  }
}
```

## 🛠️ 实践操作

### 步骤1：执行数据库索引优化

```bash
# 连接到 D1 数据库并执行索引创建
wrangler d1 execute vue-blog-prod --file=src/db/optimize-indexes.sql

# 验证索引创建结果
wrangler d1 execute vue-blog-prod --command="
SELECT name, sql FROM sqlite_master
WHERE type='index' AND name LIKE 'idx_%';"
```

### 步骤2：配置缓存中间件

```typescript
// src/index.ts
import { Hono } from 'hono'
import { cacheMiddleware } from './middleware/cache'
import { trpcServer } from './trpc'

const app = new Hono()

// 应用缓存中间件
app.use('/api/*', cacheMiddleware)
app.use('/trpc/*', trpcServer)

export default app
```

### 步骤3：优化前端查询调用

```typescript
// src/stores/articles.ts
import { defineStore } from 'pinia'
import { useQuery } from '@tanstack/vue-query'
import { batchManager } from '@/utils/batch-requests'

export const useArticlesStore = defineStore('articles', () => {
  // 使用 Query 缓存的文章列表
  const useArticleList = (params: ArticleListParams) => {
    return useQuery({
      queryKey: ['articles', params],
      queryFn: () => trpc.articles.getList.query(params),
      staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
      cacheTime: 10 * 60 * 1000, // 缓存保留 10 分钟
    })
  }

  // 批量获取文章详情
  const batchGetArticles = async (ids: string[]) => {
    return Promise.all(
      ids.map(id =>
        batchManager.batchRequest(
          'getArticleDetails',
          id,
          (articleIds: string[]) =>
            trpc.articles.getByIds.query({ ids: articleIds }),
        ),
      ),
    )
  }

  return {
    useArticleList,
    batchGetArticles,
  }
})
```

## 🔍 深入思考

### 性能优化的层次结构

1. **数据库层**：索引优化、查询优化、连接池管理
2. **应用层**：缓存策略、批处理、异步处理
3. **网络层**：CDN、压缩、合并请求
4. **客户端层**：本地缓存、预加载、懒加载

### 缓存策略的权衡

- **内存缓存**：速度快但容量有限
- **边缘缓存**：地理分布广但失效复杂
- **浏览器缓存**：减少网络请求但控制有限
- **数据库缓存**：减少计算但可能数据不一致

## ❓ 遇到的问题

### 问题 1：缓存失效时机难以把握

**问题描述**：数据更新后，相关缓存不能及时失效导致数据不一致  
**解决方案**：

- 实现基于事件的缓存失效机制
- 使用缓存标签进行批量失效
- 设置合理的缓存过期时间

### 问题 2：批处理请求的超时处理

**问题描述**：批处理等待时间过长影响用户体验  
**解决方案**：

- 设置合理的批处理延迟时间
- 实现动态批处理大小调整
- 添加超时和重试机制

## 💡 个人心得

### 今天最大的收获

理解了数据库索引对查询性能的巨大影响，以及缓存在不同层次的作用和权衡。

### 性能优化的核心原则

1. **测量驱动**：先测量再优化，避免过早优化
2. **分层优化**：从数据库到前端的全栈优化思维
3. **缓存平衡**：在性能和一致性之间找到平衡点

## 📋 行动清单

### 今日完成

- [x] 设计并实施数据库索引优化方案
- [x] 配置 Cloudflare Workers 多层缓存策略
- [x] 实现前端请求批处理优化
- [x] 建立性能监控和缓存统计机制

### 明日预习

- [ ] 了解错误处理和日志系统设计
- [ ] 思考统一错误码和用户友好提示
- [ ] 准备后端日志记录实现

## 🔗 有用链接

- [Cloudflare Workers 缓存文档](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [SQLite 索引优化指南](https://sqlite.org/queryplanner.html)
- [Vue Query 缓存策略](https://tanstack.com/query/latest/docs/vue/overview)
- [批处理请求最佳实践](https://web.dev/optimize-lcp/#batch-multiple-dom-reads-and-writes)

---

**📝 明日重点**：完善错误处理机制，实现统一的日志系统。
