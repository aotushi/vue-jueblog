# Day 15: 文章管理模块重构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建 articles 表和相关 procedures
- [ ] 实现文章列表查询 procedure
- [ ] 实现文章详情查询 procedure
- [ ] 更新前端文章相关的 store 调用

## 📚 学习笔记

### 文章数据模型设计

#### 数据库表结构

```sql
-- 文章主表
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT DEFAULT '',
  author_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 文章标签关联表
CREATE TABLE article_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, tag)
);
```

#### Zod Schema 定义

```typescript
// src/trpc/schemas/article.ts
import { z } from 'zod'

export const CreateArticleSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不超过200字符'),
  content: z.string().min(10, '内容至少10个字符'),
  summary: z.string().max(500, '摘要不超过500字符').optional(),
  tags: z.array(z.string()).max(10, '标签不超过10个').optional(),
  status: z.enum(['draft', 'published']).default('draft'),
})

export const UpdateArticleSchema = CreateArticleSchema.partial().extend({
  id: z.string().uuid('无效的文章ID'),
})

export const ArticleListQuerySchema = z.object({
  page: z.number().min(1).default(1),
  size: z.number().min(1).max(50).default(10),
  status: z.enum(['draft', 'published', 'all']).optional(),
  authorId: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
})

export const ArticleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    avatar: z.string(),
  }),
  tags: z.array(z.string()),
  status: z.string(),
  viewCount: z.number(),
  likeCount: z.number(),
  commentCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
})

export type CreateArticle = z.infer<typeof CreateArticleSchema>
export type UpdateArticle = z.infer<typeof UpdateArticleSchema>
export type ArticleListQuery = z.infer<typeof ArticleListQuerySchema>
export type ArticleResponse = z.infer<typeof ArticleResponseSchema>
```

## 🛠️ tRPC Procedures 实现

### 文章相关 Procedures

```typescript
// src/trpc/articles.ts
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from './router'
import {
  CreateArticleSchema,
  UpdateArticleSchema,
  ArticleListQuerySchema,
} from './schemas/article'

export const articleRouter = router({
  // 创建文章
  create: protectedProcedure
    .input(CreateArticleSchema)
    .mutation(async ({ input, ctx }) => {
      const articleId = crypto.randomUUID()
      const userId = ctx.user.id

      // 插入文章
      await ctx.env.DB.prepare(
        `
        INSERT INTO articles (id, title, content, summary, author_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
      )
        .bind(
          articleId,
          input.title,
          input.content,
          input.summary || '',
          userId,
          input.status,
        )
        .run()

      // 插入标签
      if (input.tags && input.tags.length > 0) {
        for (const tag of input.tags) {
          await ctx.env.DB.prepare(
            `
            INSERT INTO article_tags (article_id, tag) VALUES (?, ?)
          `,
          )
            .bind(articleId, tag)
            .run()
        }
      }

      return { id: articleId, message: '文章创建成功' }
    }),

  // 文章列表查询
  list: publicProcedure
    .input(ArticleListQuerySchema)
    .query(async ({ input, ctx }) => {
      const { page, size, status, authorId, tag, search } = input
      const offset = (page - 1) * size

      // 构建查询条件
      let whereClause = '1=1'
      const params: any[] = []

      if (status && status !== 'all') {
        whereClause += ' AND a.status = ?'
        params.push(status)
      }

      if (authorId) {
        whereClause += ' AND a.author_id = ?'
        params.push(authorId)
      }

      if (search) {
        whereClause += ' AND (a.title LIKE ? OR a.content LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }

      // 标签过滤需要 JOIN
      let joinClause = ''
      if (tag) {
        joinClause = 'JOIN article_tags at ON a.id = at.article_id'
        whereClause += ' AND at.tag = ?'
        params.push(tag)
      }

      // 查询文章列表
      const query = `
        SELECT 
          a.id,
          a.title,
          a.summary,
          a.status,
          a.view_count,
          a.like_count,
          a.comment_count,
          a.created_at,
          a.published_at,
          u.id as author_id,
          u.username as author_name,
          u.avatar as author_avatar
        FROM articles a
        JOIN users u ON a.author_id = u.id
        ${joinClause}
        WHERE ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `

      const articles = await ctx.env.DB.prepare(query)
        .bind(...params, size, offset)
        .all()

      // 查询总数
      const countQuery = `
        SELECT COUNT(DISTINCT a.id) as total
        FROM articles a
        JOIN users u ON a.author_id = u.id
        ${joinClause}
        WHERE ${whereClause}
      `

      const { total } = await ctx.env.DB.prepare(countQuery)
        .bind(...params)
        .first()

      // 查询文章标签
      for (const article of articles.results) {
        const tags = await ctx.env.DB.prepare(
          `
          SELECT tag FROM article_tags WHERE article_id = ?
        `,
        )
          .bind(article.id)
          .all()

        article.tags = tags.results.map(t => t.tag)
      }

      return {
        articles: articles.results.map(formatArticleResponse),
        pagination: {
          page,
          size,
          total: total as number,
          totalPages: Math.ceil((total as number) / size),
        },
      }
    }),

  // 文章详情查询
  detail: publicProcedure
    .input(z.string().uuid('无效的文章ID'))
    .query(async ({ input: articleId, ctx }) => {
      // 查询文章信息
      const article = await ctx.env.DB.prepare(
        `
        SELECT 
          a.*,
          u.id as author_id,
          u.username as author_name,
          u.avatar as author_avatar
        FROM articles a
        JOIN users u ON a.author_id = u.id
        WHERE a.id = ?
      `,
      )
        .bind(articleId)
        .first()

      if (!article) {
        throw new Error('文章不存在')
      }

      // 查询文章标签
      const tags = await ctx.env.DB.prepare(
        `
        SELECT tag FROM article_tags WHERE article_id = ?
      `,
      )
        .bind(articleId)
        .all()

      // 增加浏览量
      await ctx.env.DB.prepare(
        `
        UPDATE articles SET view_count = view_count + 1 WHERE id = ?
      `,
      )
        .bind(articleId)
        .run()

      return {
        ...formatArticleResponse(article),
        tags: tags.results.map(t => t.tag),
      }
    }),

  // 更新文章
  update: protectedProcedure
    .input(UpdateArticleSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input

      // 检查文章所有权
      const article = await ctx.env.DB.prepare(
        `
        SELECT author_id FROM articles WHERE id = ?
      `,
      )
        .bind(id)
        .first()

      if (!article) {
        throw new Error('文章不存在')
      }

      if (article.author_id !== ctx.user.id) {
        throw new Error('无权限修改此文章')
      }

      // 更新文章
      const updateFields: string[] = []
      const params: any[] = []

      if (updateData.title) {
        updateFields.push('title = ?')
        params.push(updateData.title)
      }

      if (updateData.content) {
        updateFields.push('content = ?')
        params.push(updateData.content)
      }

      if (updateData.summary !== undefined) {
        updateFields.push('summary = ?')
        params.push(updateData.summary)
      }

      if (updateData.status) {
        updateFields.push('status = ?')
        params.push(updateData.status)

        // 如果发布，设置发布时间
        if (updateData.status === 'published') {
          updateFields.push('published_at = datetime("now")')
        }
      }

      updateFields.push('updated_at = datetime("now")')
      params.push(id)

      await ctx.env.DB.prepare(
        `
        UPDATE articles SET ${updateFields.join(', ')} WHERE id = ?
      `,
      )
        .bind(...params)
        .run()

      // 更新标签
      if (updateData.tags) {
        // 删除旧标签
        await ctx.env.DB.prepare(
          `
          DELETE FROM article_tags WHERE article_id = ?
        `,
        )
          .bind(id)
          .run()

        // 插入新标签
        for (const tag of updateData.tags) {
          await ctx.env.DB.prepare(
            `
            INSERT INTO article_tags (article_id, tag) VALUES (?, ?)
          `,
          )
            .bind(id, tag)
            .run()
        }
      }

      return { message: '文章更新成功' }
    }),

  // 删除文章
  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input: articleId, ctx }) => {
      // 检查所有权
      const article = await ctx.env.DB.prepare(
        `
        SELECT author_id FROM articles WHERE id = ?
      `,
      )
        .bind(articleId)
        .first()

      if (!article) {
        throw new Error('文章不存在')
      }

      if (article.author_id !== ctx.user.id) {
        throw new Error('无权限删除此文章')
      }

      // 删除文章（标签会被级联删除）
      await ctx.env.DB.prepare(
        `
        DELETE FROM articles WHERE id = ?
      `,
      )
        .bind(articleId)
        .run()

      return { message: '文章删除成功' }
    }),
})

// 格式化文章响应
function formatArticleResponse(article: any): ArticleResponse {
  return {
    id: article.id,
    title: article.title,
    content: article.content || '',
    summary: article.summary || '',
    author: {
      id: article.author_id,
      username: article.author_name,
      avatar: article.author_avatar || '',
    },
    tags: article.tags || [],
    status: article.status,
    viewCount: article.view_count || 0,
    likeCount: article.like_count || 0,
    commentCount: article.comment_count || 0,
    createdAt: article.created_at,
    updatedAt: article.updated_at,
    publishedAt: article.published_at,
  }
}
```

## 🔍 前端 Store 更新

### 更新 Pinia Store 调用

```typescript
// src/stores/article.ts (原有的需要更新)
import { defineStore } from 'pinia'
import { trpc } from '@/trpc/client'

export const useArticleStore = defineStore('article', () => {
  const articles = ref<Article[]>([])
  const currentArticle = ref<Article | null>(null)
  const loading = ref(false)

  // 获取文章列表
  const fetchArticles = async (query: ArticleListQuery) => {
    loading.value = true
    try {
      const response = await trpc.articles.list.query(query)
      articles.value = response.articles
      return response.pagination
    } catch (error) {
      console.error('获取文章列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取文章详情
  const fetchArticleDetail = async (id: string) => {
    loading.value = true
    try {
      currentArticle.value = await trpc.articles.detail.query(id)
      return currentArticle.value
    } catch (error) {
      console.error('获取文章详情失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 创建文章
  const createArticle = async (data: CreateArticle) => {
    try {
      return await trpc.articles.create.mutate(data)
    } catch (error) {
      console.error('创建文章失败:', error)
      throw error
    }
  }

  // 更新文章
  const updateArticle = async (data: UpdateArticle) => {
    try {
      const result = await trpc.articles.update.mutate(data)
      // 更新本地状态
      if (currentArticle.value && currentArticle.value.id === data.id) {
        await fetchArticleDetail(data.id)
      }
      return result
    } catch (error) {
      console.error('更新文章失败:', error)
      throw error
    }
  }

  return {
    articles,
    currentArticle,
    loading,
    fetchArticles,
    fetchArticleDetail,
    createArticle,
    updateArticle,
  }
})
```

## ❓ 遇到的问题

### 问题 1：分页查询性能优化

**问题描述**：大量文章时分页查询变慢  
**解决方案**：

```sql
-- 添加复合索引
CREATE INDEX idx_articles_status_created_at ON articles(status, created_at DESC);
CREATE INDEX idx_articles_author_created ON articles(author_id, created_at DESC);

-- 使用 LIMIT + OFFSET 的替代方案（游标分页）
SELECT * FROM articles
WHERE created_at < ?
ORDER BY created_at DESC
LIMIT ?
```

### 问题 2：标签查询的 N+1 问题

**问题描述**：查询每篇文章的标签导致多次数据库查询  
**解决方案**：

```typescript
// 批量查询标签
const articleIds = articles.map(a => a.id)
const allTags = await ctx.env.DB.prepare(
  `
  SELECT article_id, tag FROM article_tags 
  WHERE article_id IN (${articleIds.map(() => '?').join(',')})
`,
)
  .bind(...articleIds)
  .all()

// 组装标签数据
const tagMap = new Map()
allTags.results.forEach(tag => {
  if (!tagMap.has(tag.article_id)) {
    tagMap.set(tag.article_id, [])
  }
  tagMap.get(tag.article_id).push(tag.tag)
})
```

## 💡 个人心得

### 今天最大的收获

完成了文章模块从 REST API 到 tRPC 的完整迁移，深刻体会到了类型安全带来的开发效率提升。

### 性能优化的思考

边缘数据库的查询优化与传统数据库有所不同，需要更多考虑网络延迟和查询复杂度。

## 📋 行动清单

### 今日完成

- [ ] 创建文章相关的数据库表和索引
- [ ] 实现完整的文章 CRUD operations
- [ ] 更新前端 Store 使用 tRPC 调用

### 明日预习

- [ ] 了解评论系统的数据结构设计
- [ ] 思考层级评论（回复功能）的实现方案

## 🔗 有用链接

- [tRPC 最佳实践](https://trpc.io/docs/server/best-practices)
- [SQLite 性能优化](https://www.sqlite.org/optoverview.html)
- [Cloudflare D1 查询优化](https://developers.cloudflare.com/d1/tutorials/optimize-queries/)

---

**📝 明日重点**：实现评论系统模块，处理层级评论的复杂查询。
