# Day 16: 评论系统模块重构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建 comments 表结构
- [ ] 实现评论 CRUD procedures
- [ ] 处理评论的层级关系（回复功能）
- [ ] 测试评论功能

## 📚 学习笔记

### 评论系统架构设计

#### 层级评论数据模型

```sql
-- 评论表结构（支持无限层级回复）
CREATE TABLE comments (
  id TEXT PRIMARY KEY,              -- 评论ID
  content TEXT NOT NULL,            -- 评论内容
  author_id TEXT NOT NULL,          -- 评论者ID
  source_id TEXT NOT NULL,          -- 被评论的对象ID
  source_type TEXT NOT NULL,        -- 对象类型：article/shortmsg
  parent_id TEXT,                   -- 父评论ID（NULL = 顶级评论）
  root_id TEXT,                     -- 根评论ID（用于快速查询整棵评论树）
  reply_to_user_id TEXT,            -- 回复的目标用户ID
  like_count INTEGER DEFAULT 0,     -- 评论点赞数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id),
  FOREIGN KEY (root_id) REFERENCES comments(id),
  CHECK (source_type IN ('article', 'shortmsg'))
);
```

#### 评论树形结构

```
顶级评论 (root_id = NULL, parent_id = NULL)
├── 一级回复 (root_id = 顶级评论ID, parent_id = 顶级评论ID)
│   ├── 二级回复 (root_id = 顶级评论ID, parent_id = 一级回复ID)
│   └── 二级回复 (root_id = 顶级评论ID, parent_id = 一级回复ID)
└── 一级回复 (root_id = 顶级评论ID, parent_id = 顶级评论ID)
    └── 二级回复 (root_id = 顶级评论ID, parent_id = 一级回复ID)
```

### Zod Schema 定义

```typescript
// src/trpc/schemas/comment.ts
import { z } from 'zod'

export const CreateCommentSchema = z.object({
  content: z
    .string()
    .min(1, '评论内容不能为空')
    .max(500, '评论内容不超过500字符'),
  source_id: z.string().uuid('无效的源对象ID'),
  source_type: z.enum(['article', 'shortmsg'], {
    errorMap: () => ({ message: '无效的评论类型' }),
  }),
  parent_id: z.string().uuid().optional(), // 回复评论时提供
  reply_to_user_id: z.string().uuid().optional(), // 回复特定用户时提供
})

export const CommentListQuerySchema = z.object({
  source_id: z.string().uuid('无效的源对象ID'),
  source_type: z.enum(['article', 'shortmsg']),
  page: z.number().min(1).default(1),
  size: z.number().min(1).max(50).default(20),
  sort: z.enum(['latest', 'oldest', 'hot']).default('latest'),
})

export const CommentResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    avatar: z.string(),
  }),
  parent_id: z.string().nullable(),
  root_id: z.string().nullable(),
  reply_to_user: z
    .object({
      id: z.string(),
      username: z.string(),
    })
    .nullable(),
  like_count: z.number(),
  is_liked: z.boolean(), // 当前用户是否点赞
  created_at: z.string(),
  replies: z.array(z.lazy(() => CommentResponseSchema)).optional(), // 递归类型
})

export type CreateComment = z.infer<typeof CreateCommentSchema>
export type CommentListQuery = z.infer<typeof CommentListQuerySchema>
export type CommentResponse = z.infer<typeof CommentResponseSchema>
```

## 🛠️ tRPC Procedures 实现

### 评论相关 Procedures

```typescript
// src/trpc/comments.ts
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from './router'
import { CreateCommentSchema, CommentListQuerySchema } from './schemas/comment'

export const commentRouter = router({
  // 创建评论
  create: protectedProcedure
    .input(CreateCommentSchema)
    .mutation(async ({ input, ctx }) => {
      const commentId = crypto.randomUUID()
      const userId = ctx.user.id

      let rootId = null
      let parentId = input.parent_id || null

      // 如果是回复评论，需要确定根评论ID
      if (parentId) {
        const parentComment = await ctx.env.DB.prepare(
          `
          SELECT root_id, id FROM comments WHERE id = ?
        `,
        )
          .bind(parentId)
          .first()

        if (!parentComment) {
          throw new Error('父评论不存在')
        }

        // 如果父评论本身就是根评论，则根ID就是父评论ID
        // 否则使用父评论的根ID
        rootId = parentComment.root_id || parentComment.id
      }

      // 验证被评论的对象是否存在
      if (input.source_type === 'article') {
        const article = await ctx.env.DB.prepare(
          `
          SELECT id FROM articles WHERE id = ?
        `,
        )
          .bind(input.source_id)
          .first()

        if (!article) {
          throw new Error('文章不存在')
        }
      }

      // 插入评论
      await ctx.env.DB.prepare(
        `
        INSERT INTO comments (
          id, content, author_id, source_id, source_type, 
          parent_id, root_id, reply_to_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      )
        .bind(
          commentId,
          input.content,
          userId,
          input.source_id,
          input.source_type,
          parentId,
          rootId,
          input.reply_to_user_id || null,
        )
        .run()

      // 更新源对象的评论计数
      if (input.source_type === 'article') {
        await ctx.env.DB.prepare(
          `
          UPDATE articles 
          SET comment_count = comment_count + 1 
          WHERE id = ?
        `,
        )
          .bind(input.source_id)
          .run()
      }

      return {
        id: commentId,
        message: '评论发布成功',
      }
    }),

  // 获取评论列表
  list: publicProcedure
    .input(CommentListQuerySchema)
    .query(async ({ input, ctx }) => {
      const { source_id, source_type, page, size, sort } = input
      const offset = (page - 1) * size

      // 构建排序条件
      let orderBy = 'c.created_at DESC'
      if (sort === 'oldest') {
        orderBy = 'c.created_at ASC'
      } else if (sort === 'hot') {
        orderBy = 'c.like_count DESC, c.created_at DESC'
      }

      // 查询顶级评论
      const topLevelComments = await ctx.env.DB.prepare(
        `
        SELECT 
          c.id,
          c.content,
          c.parent_id,
          c.root_id,
          c.like_count,
          c.created_at,
          u.id as author_id,
          u.username as author_name,
          u.avatar as author_avatar,
          ru.id as reply_to_user_id,
          ru.username as reply_to_username
        FROM comments c
        JOIN users u ON c.author_id = u.id
        LEFT JOIN users ru ON c.reply_to_user_id = ru.id
        WHERE c.source_id = ? 
          AND c.source_type = ? 
          AND c.parent_id IS NULL
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
      )
        .bind(source_id, source_type, size, offset)
        .all()

      const comments = []

      // 为每个顶级评论获取回复
      for (const comment of topLevelComments.results) {
        const replies = await getCommentReplies(
          ctx.env.DB,
          comment.id,
          ctx.user?.id,
        )

        comments.push({
          id: comment.id,
          content: comment.content,
          author: {
            id: comment.author_id,
            username: comment.author_name,
            avatar: comment.author_avatar || '',
          },
          parent_id: comment.parent_id,
          root_id: comment.root_id,
          reply_to_user: comment.reply_to_user_id
            ? {
                id: comment.reply_to_user_id,
                username: comment.reply_to_username,
              }
            : null,
          like_count: comment.like_count,
          is_liked: ctx.user
            ? await isCommentLiked(ctx.env.DB, comment.id, ctx.user.id)
            : false,
          created_at: comment.created_at,
          replies,
        })
      }

      // 查询总数
      const { total } = await ctx.env.DB.prepare(
        `
        SELECT COUNT(*) as total 
        FROM comments 
        WHERE source_id = ? AND source_type = ? AND parent_id IS NULL
      `,
      )
        .bind(source_id, source_type)
        .first()

      return {
        comments,
        pagination: {
          page,
          size,
          total: total as number,
          totalPages: Math.ceil((total as number) / size),
        },
      }
    }),

  // 删除评论
  delete: protectedProcedure
    .input(z.string().uuid('无效的评论ID'))
    .mutation(async ({ input: commentId, ctx }) => {
      // 检查评论所有权
      const comment = await ctx.env.DB.prepare(
        `
        SELECT author_id, source_id, source_type FROM comments WHERE id = ?
      `,
      )
        .bind(commentId)
        .first()

      if (!comment) {
        throw new Error('评论不存在')
      }

      if (comment.author_id !== ctx.user.id) {
        throw new Error('无权限删除此评论')
      }

      // 删除评论及其所有子评论
      await ctx.env.DB.prepare(
        `
        DELETE FROM comments WHERE id = ? OR root_id = ?
      `,
      )
        .bind(commentId, commentId)
        .run()

      // 更新源对象的评论计数
      if (comment.source_type === 'article') {
        await ctx.env.DB.prepare(
          `
          UPDATE articles 
          SET comment_count = comment_count - 1 
          WHERE id = ?
        `,
        )
          .bind(comment.source_id)
          .run()
      }

      return { message: '评论删除成功' }
    }),

  // 点赞/取消点赞评论
  toggleLike: protectedProcedure
    .input(z.string().uuid('无效的评论ID'))
    .mutation(async ({ input: commentId, ctx }) => {
      const userId = ctx.user.id

      // 检查是否已经点赞
      const existingLike = await ctx.env.DB.prepare(
        `
        SELECT id FROM praises 
        WHERE user_id = ? AND source_id = ? AND source_type = 'comment'
      `,
      )
        .bind(userId, commentId)
        .first()

      if (existingLike) {
        // 取消点赞
        await ctx.env.DB.prepare(
          `
          DELETE FROM praises 
          WHERE user_id = ? AND source_id = ? AND source_type = 'comment'
        `,
        )
          .bind(userId, commentId)
          .run()

        await ctx.env.DB.prepare(
          `
          UPDATE comments SET like_count = like_count - 1 WHERE id = ?
        `,
        )
          .bind(commentId)
          .run()

        return { liked: false, message: '取消点赞' }
      } else {
        // 添加点赞
        await ctx.env.DB.prepare(
          `
          INSERT INTO praises (user_id, source_id, source_type, created_at)
          VALUES (?, ?, 'comment', datetime('now'))
        `,
        )
          .bind(userId, commentId)
          .run()

        await ctx.env.DB.prepare(
          `
          UPDATE comments SET like_count = like_count + 1 WHERE id = ?
        `,
        )
          .bind(commentId)
          .run()

        return { liked: true, message: '点赞成功' }
      }
    }),
})

// 递归获取评论回复
async function getCommentReplies(
  db: D1Database,
  parentId: string,
  currentUserId?: string,
) {
  const replies = await db
    .prepare(
      `
    SELECT 
      c.id,
      c.content,
      c.parent_id,
      c.root_id,
      c.like_count,
      c.created_at,
      u.id as author_id,
      u.username as author_name,
      u.avatar as author_avatar,
      ru.id as reply_to_user_id,
      ru.username as reply_to_username
    FROM comments c
    JOIN users u ON c.author_id = u.id
    LEFT JOIN users ru ON c.reply_to_user_id = ru.id
    WHERE c.parent_id = ?
    ORDER BY c.created_at ASC
  `,
    )
    .bind(parentId)
    .all()

  const result = []

  for (const reply of replies.results) {
    const nestedReplies = await getCommentReplies(db, reply.id, currentUserId)

    result.push({
      id: reply.id,
      content: reply.content,
      author: {
        id: reply.author_id,
        username: reply.author_name,
        avatar: reply.author_avatar || '',
      },
      parent_id: reply.parent_id,
      root_id: reply.root_id,
      reply_to_user: reply.reply_to_user_id
        ? {
            id: reply.reply_to_user_id,
            username: reply.reply_to_username,
          }
        : null,
      like_count: reply.like_count,
      is_liked: currentUserId
        ? await isCommentLiked(db, reply.id, currentUserId)
        : false,
      created_at: reply.created_at,
      replies: nestedReplies,
    })
  }

  return result
}

// 检查用户是否点赞了评论
async function isCommentLiked(
  db: D1Database,
  commentId: string,
  userId: string,
) {
  const like = await db
    .prepare(
      `
    SELECT id FROM praises 
    WHERE user_id = ? AND source_id = ? AND source_type = 'comment'
  `,
    )
    .bind(userId, commentId)
    .first()

  return !!like
}
```

## 🔍 前端评论组件实现

### Vue 评论组件

```vue
<!-- src/components/CommentSection.vue -->
<template>
  <div class="comment-section">
    <h3>评论 ({{ totalComments }})</h3>

    <!-- 发表评论 -->
    <div v-if="isAuthenticated" class="comment-form">
      <el-input
        v-model="newComment"
        type="textarea"
        :rows="3"
        placeholder="写下你的评论..."
        maxlength="500"
        show-word-limit
      />
      <div class="comment-actions">
        <el-button
          type="primary"
          :loading="isSubmitting"
          @click="submitComment"
        >
          发表评论
        </el-button>
      </div>
    </div>

    <div v-else class="login-tip">
      <span>请 <a @click="showLogin">登录</a> 后发表评论</span>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list">
      <CommentItem
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :source-id="sourceId"
        :source-type="sourceType"
        @reply="handleReply"
        @delete="handleDelete"
      />
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <el-button :loading="isLoading" @click="loadMore">
        加载更多评论
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useTRPC'
import { trpc } from '@/trpc/client'
import CommentItem from './CommentItem.vue'
import { ElMessage } from 'element-plus'

interface Props {
  sourceId: string
  sourceType: 'article' | 'shortmsg'
}

const props = defineProps<Props>()
const { user, isAuthenticated } = useAuth()

const comments = ref([])
const newComment = ref('')
const isSubmitting = ref(false)
const isLoading = ref(false)
const currentPage = ref(1)
const totalComments = ref(0)
const hasMore = ref(true)

const submitComment = async () => {
  if (!newComment.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }

  isSubmitting.value = true
  try {
    await trpc.comments.create.mutate({
      content: newComment.value.trim(),
      source_id: props.sourceId,
      source_type: props.sourceType,
    })

    newComment.value = ''
    ElMessage.success('评论发表成功')

    // 重新加载评论列表
    await loadComments(true)
  } catch (error: any) {
    ElMessage.error(error.message || '评论发表失败')
  } finally {
    isSubmitting.value = false
  }
}

const loadComments = async (reset = false) => {
  if (reset) {
    currentPage.value = 1
    comments.value = []
  }

  isLoading.value = true
  try {
    const result = await trpc.comments.list.query({
      source_id: props.sourceId,
      source_type: props.sourceType,
      page: currentPage.value,
      size: 10,
    })

    if (reset) {
      comments.value = result.comments
    } else {
      comments.value.push(...result.comments)
    }

    totalComments.value = result.pagination.total
    hasMore.value = currentPage.value < result.pagination.totalPages
  } catch (error: any) {
    ElMessage.error('加载评论失败')
  } finally {
    isLoading.value = false
  }
}

const loadMore = async () => {
  currentPage.value++
  await loadComments()
}

const handleReply = (comment: any, content: string) => {
  // 处理回复逻辑
  console.log('回复评论:', comment, content)
}

const handleDelete = async (commentId: string) => {
  try {
    await trpc.comments.delete.mutate(commentId)
    ElMessage.success('评论删除成功')
    await loadComments(true)
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败')
  }
}

onMounted(() => {
  loadComments(true)
})
</script>

<style scoped>
.comment-section {
  margin-top: 2rem;
}

.comment-form {
  margin: 1rem 0;
}

.comment-actions {
  margin-top: 0.5rem;
  text-align: right;
}

.login-tip {
  text-align: center;
  padding: 1rem;
  color: #666;
}

.login-tip a {
  color: #409eff;
  cursor: pointer;
}

.comment-list {
  margin: 1rem 0;
}

.load-more {
  text-align: center;
  margin: 1rem 0;
}
</style>
```

## ❓ 遇到的问题

### 问题 1：递归查询性能问题

**问题描述**：深度嵌套的评论查询可能导致性能问题  
**解决方案**：

- 限制递归深度（如最多3层）
- 使用懒加载，点击"查看更多回复"时才加载
- 考虑扁平化存储，前端组装树形结构

### 问题 2：评论删除的级联处理

**问题描述**：删除父评论时，子评论如何处理  
**解决方案**：

```sql
-- 方案1: 级联删除所有子评论
DELETE FROM comments WHERE id = ? OR root_id = ?

-- 方案2: 软删除，保留子评论
UPDATE comments SET content = '[该评论已删除]', deleted = 1 WHERE id = ?
```

## 💡 个人心得

### 今天最大的收获

实现了完整的层级评论系统，深刻理解了树形数据结构在关系数据库中的存储和查询方式。

### 评论系统设计的关键点

1. **数据结构设计**：`parent_id` + `root_id` 的组合能够高效处理无限层级
2. **查询优化**：递归查询需要控制深度，避免性能问题
3. **用户体验**：实时更新评论数，提供良好的交互反馈

## 📋 行动清单

### 今日完成

- [x] 设计评论表结构和索引
- [x] 实现评论CRUD的tRPC procedures
- [x] 处理层级回复的复杂逻辑
- [x] 创建前端评论组件

### 明日预习

- [ ] 了解点赞系统的数据设计
- [ ] 思考如何防止重复点赞
- [ ] 准备点赞状态的实时同步

## 🔗 有用链接

- [树形数据库设计模式](https://www.slideshare.net/billkarwin/models-for-hierarchical-data)
- [SQLite 递归查询](https://www.sqlite.org/lang_with.html)
- [评论系统最佳实践](https://github.com/discourse/discourse)

---

**📝 明日重点**：实现点赞收藏模块，处理用户互动功能。
