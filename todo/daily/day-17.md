# Day 17: 点赞收藏系统模块重构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建 praises 表结构（统一点赞和收藏）
- [ ] 实现点赞/收藏 CRUD procedures
- [ ] 处理防重复点赞逻辑
- [ ] 测试点赞收藏功能

## 📚 学习笔记

### 统一的点赞收藏系统设计

#### 数据模型设计思路

```
传统方案：
├── likes 表 (文章点赞)
├── article_collections 表 (文章收藏)
├── comment_likes 表 (评论点赞)
└── user_follows 表 (用户关注)

统一方案：
└── praises 表 (统一所有"赞"行为)
    ├── 文章点赞 (source_type: 'article', action_type: 'like')
    ├── 文章收藏 (source_type: 'article', action_type: 'collect')
    ├── 评论点赞 (source_type: 'comment', action_type: 'like')
    └── 用户关注 (source_type: 'user', action_type: 'follow')
```

#### 统一点赞表设计

```sql
-- 统一的点赞收藏表
CREATE TABLE praises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,              -- 操作用户ID
  source_id TEXT NOT NULL,            -- 被操作对象ID
  source_type TEXT NOT NULL,          -- 对象类型: article, comment, user
  action_type TEXT NOT NULL,          -- 操作类型: like, collect, follow
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 同一用户对同一对象的同一操作只能有一次
  UNIQUE(user_id, source_id, source_type, action_type),
  CHECK (source_type IN ('article', 'comment', 'user')),
  CHECK (action_type IN ('like', 'collect', 'follow'))
);

-- 索引优化
CREATE INDEX idx_praises_user_id ON praises(user_id);
CREATE INDEX idx_praises_source ON praises(source_id, source_type);
CREATE INDEX idx_praises_composite ON praises(source_id, source_type, action_type);
```

### Zod Schema 定义

```typescript
// src/trpc/schemas/praise.ts
import { z } from 'zod'

export const PraiseActionSchema = z.object({
  source_id: z.string().uuid('无效的对象ID'),
  source_type: z.enum(['article', 'comment', 'user'], {
    errorMap: () => ({ message: '无效的对象类型' }),
  }),
  action_type: z.enum(['like', 'collect', 'follow'], {
    errorMap: () => ({ message: '无效的操作类型' }),
  }),
})

export const PraiseListQuerySchema = z.object({
  user_id: z.string().uuid().optional(), // 查询特定用户的点赞记录
  source_type: z.enum(['article', 'comment', 'user']).optional(),
  action_type: z.enum(['like', 'collect', 'follow']).optional(),
  page: z.number().min(1).default(1),
  size: z.number().min(1).max(50).default(20),
})

export const PraiseStatsSchema = z.object({
  source_id: z.string().uuid(),
  source_type: z.enum(['article', 'comment', 'user']),
})

export const PraiseResponseSchema = z.object({
  id: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    avatar: z.string(),
  }),
  source_id: z.string(),
  source_type: z.string(),
  action_type: z.string(),
  created_at: z.string(),
})

export type PraiseAction = z.infer<typeof PraiseActionSchema>
export type PraiseListQuery = z.infer<typeof PraiseListQuerySchema>
export type PraiseStats = z.infer<typeof PraiseStatsSchema>
export type PraiseResponse = z.infer<typeof PraiseResponseSchema>
```

## 🛠️ tRPC Procedures 实现

### 点赞收藏相关 Procedures

```typescript
// src/trpc/praises.ts
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from './router'
import {
  PraiseActionSchema,
  PraiseListQuerySchema,
  PraiseStatsSchema,
} from './schemas/praise'

export const praiseRouter = router({
  // 切换点赞/收藏状态
  toggle: protectedProcedure
    .input(PraiseActionSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { source_id, source_type, action_type } = input

      // 验证被操作对象是否存在
      await validateSourceExists(ctx.env.DB, source_id, source_type)

      // 检查是否已经存在
      const existing = await ctx.env.DB.prepare(
        `
        SELECT id FROM praises 
        WHERE user_id = ? AND source_id = ? AND source_type = ? AND action_type = ?
      `,
      )
        .bind(userId, source_id, source_type, action_type)
        .first()

      if (existing) {
        // 取消操作
        await ctx.env.DB.prepare(
          `
          DELETE FROM praises 
          WHERE user_id = ? AND source_id = ? AND source_type = ? AND action_type = ?
        `,
        )
          .bind(userId, source_id, source_type, action_type)
          .run()

        // 更新计数
        await updateSourceCount(
          ctx.env.DB,
          source_id,
          source_type,
          action_type,
          -1,
        )

        return {
          action: 'removed',
          message: getActionMessage(action_type, false),
        }
      } else {
        // 添加操作
        const praiseId = crypto.randomUUID()

        await ctx.env.DB.prepare(
          `
          INSERT INTO praises (id, user_id, source_id, source_type, action_type, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `,
        )
          .bind(praiseId, userId, source_id, source_type, action_type)
          .run()

        // 更新计数
        await updateSourceCount(
          ctx.env.DB,
          source_id,
          source_type,
          action_type,
          1,
        )

        return {
          action: 'added',
          message: getActionMessage(action_type, true),
        }
      }
    }),

  // 批量检查用户的点赞状态
  checkUserActions: protectedProcedure
    .input(z.array(PraiseActionSchema))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const results = {}

      for (const item of input) {
        const key = `${item.source_id}_${item.source_type}_${item.action_type}`

        const praise = await ctx.env.DB.prepare(
          `
          SELECT id FROM praises 
          WHERE user_id = ? AND source_id = ? AND source_type = ? AND action_type = ?
        `,
        )
          .bind(userId, item.source_id, item.source_type, item.action_type)
          .first()

        results[key] = !!praise
      }

      return results
    }),

  // 获取对象的点赞统计
  getStats: publicProcedure
    .input(PraiseStatsSchema)
    .query(async ({ input, ctx }) => {
      const { source_id, source_type } = input

      // 获取各种操作的统计
      const stats = await ctx.env.DB.prepare(
        `
        SELECT 
          action_type,
          COUNT(*) as count
        FROM praises 
        WHERE source_id = ? AND source_type = ?
        GROUP BY action_type
      `,
      )
        .bind(source_id, source_type)
        .all()

      // 格式化结果
      const result = {
        like_count: 0,
        collect_count: 0,
        follow_count: 0,
      }

      stats.results.forEach(row => {
        result[`${row.action_type}_count`] = row.count
      })

      return result
    }),

  // 获取用户的点赞历史
  getUserHistory: protectedProcedure
    .input(PraiseListQuerySchema)
    .query(async ({ input, ctx }) => {
      const { user_id, source_type, action_type, page, size } = input
      const targetUserId = user_id || ctx.user.id
      const offset = (page - 1) * size

      // 构建查询条件
      let whereClause = 'WHERE p.user_id = ?'
      let params = [targetUserId]

      if (source_type) {
        whereClause += ' AND p.source_type = ?'
        params.push(source_type)
      }

      if (action_type) {
        whereClause += ' AND p.action_type = ?'
        params.push(action_type)
      }

      // 查询点赞记录（包含关联对象信息）
      const praises = await ctx.env.DB.prepare(
        `
        SELECT 
          p.*,
          CASE 
            WHEN p.source_type = 'article' THEN a.title
            WHEN p.source_type = 'comment' THEN c.content
            WHEN p.source_type = 'user' THEN u.username
          END as source_title,
          CASE 
            WHEN p.source_type = 'article' THEN au.username
            WHEN p.source_type = 'comment' THEN cu.username
            WHEN p.source_type = 'user' THEN u.username
          END as source_author
        FROM praises p
        LEFT JOIN articles a ON p.source_type = 'article' AND p.source_id = a.id
        LEFT JOIN users au ON a.author_id = au.id
        LEFT JOIN comments c ON p.source_type = 'comment' AND p.source_id = c.id
        LEFT JOIN users cu ON c.author_id = cu.id
        LEFT JOIN users u ON p.source_type = 'user' AND p.source_id = u.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `,
      )
        .bind(...params, size, offset)
        .all()

      // 查询总数
      const { total } = await ctx.env.DB.prepare(
        `
        SELECT COUNT(*) as total FROM praises p ${whereClause}
      `,
      )
        .bind(...params)
        .first()

      return {
        praises: praises.results.map(praise => ({
          id: praise.id,
          source_id: praise.source_id,
          source_type: praise.source_type,
          action_type: praise.action_type,
          source_title: praise.source_title || '',
          source_author: praise.source_author || '',
          created_at: praise.created_at,
        })),
        pagination: {
          page,
          size,
          total: total as number,
          totalPages: Math.ceil((total as number) / size),
        },
      }
    }),

  // 获取热门内容（基于点赞数）
  getHotContent: publicProcedure
    .input(
      z.object({
        source_type: z.enum(['article', 'comment']),
        action_type: z.enum(['like', 'collect']).default('like'),
        limit: z.number().min(1).max(50).default(10),
        days: z.number().min(1).max(30).default(7), // 最近几天
      }),
    )
    .query(async ({ input, ctx }) => {
      const { source_type, action_type, limit, days } = input

      let query = `
        SELECT 
          p.source_id,
          COUNT(*) as praise_count,
          ${source_type === 'article' ? 'a.title, a.summary, u.username as author_name' : 'c.content, u.username as author_name'}
        FROM praises p
      `

      if (source_type === 'article') {
        query += `
          JOIN articles a ON p.source_id = a.id
          JOIN users u ON a.author_id = u.id
        `
      } else {
        query += `
          JOIN comments c ON p.source_id = c.id  
          JOIN users u ON c.author_id = u.id
        `
      }

      query += `
        WHERE p.source_type = ? 
          AND p.action_type = ?
          AND p.created_at >= datetime('now', '-${days} days')
        GROUP BY p.source_id
        ORDER BY praise_count DESC, p.source_id
        LIMIT ?
      `

      const results = await ctx.env.DB.prepare(query)
        .bind(source_type, action_type, limit)
        .all()

      return results.results
    }),
})

// 验证被操作对象是否存在
async function validateSourceExists(
  db: D1Database,
  sourceId: string,
  sourceType: string,
) {
  let table = ''
  switch (sourceType) {
    case 'article':
      table = 'articles'
      break
    case 'comment':
      table = 'comments'
      break
    case 'user':
      table = 'users'
      break
    default:
      throw new Error('无效的对象类型')
  }

  const exists = await db
    .prepare(`SELECT id FROM ${table} WHERE id = ?`)
    .bind(sourceId)
    .first()

  if (!exists) {
    throw new Error(`${sourceType} 不存在`)
  }
}

// 更新源对象的计数
async function updateSourceCount(
  db: D1Database,
  sourceId: string,
  sourceType: string,
  actionType: string,
  delta: number,
) {
  if (sourceType === 'article') {
    const field = actionType === 'like' ? 'like_count' : 'collect_count'
    await db
      .prepare(
        `
      UPDATE articles 
      SET ${field} = MAX(0, ${field} + ?) 
      WHERE id = ?
    `,
      )
      .bind(delta, sourceId)
      .run()
  } else if (sourceType === 'comment' && actionType === 'like') {
    await db
      .prepare(
        `
      UPDATE comments 
      SET like_count = MAX(0, like_count + ?) 
      WHERE id = ?
    `,
      )
      .bind(delta, sourceId)
      .run()
  }
  // 用户关注数可以在用户表中维护
}

// 获取操作消息
function getActionMessage(actionType: string, isAdd: boolean): string {
  const messages = {
    like: isAdd ? '点赞成功' : '取消点赞',
    collect: isAdd ? '收藏成功' : '取消收藏',
    follow: isAdd ? '关注成功' : '取消关注',
  }
  return messages[actionType] || '操作成功'
}
```

## 🔍 前端组件实现

### Vue 点赞收藏组件

```vue
<!-- src/components/PraiseButton.vue -->
<template>
  <div class="praise-buttons">
    <!-- 点赞按钮 -->
    <el-button
      :type="isLiked ? 'primary' : 'default'"
      :icon="isLiked ? 'thumb-up' : 'thumb-up-outlined'"
      :loading="likingLoading"
      size="small"
      @click="toggleLike"
    >
      {{ likeCount }} {{ isLiked ? '已赞' : '点赞' }}
    </el-button>

    <!-- 收藏按钮 -->
    <el-button
      :type="isCollected ? 'warning' : 'default'"
      :icon="isCollected ? 'star' : 'star-outlined'"
      :loading="collectingLoading"
      size="small"
      @click="toggleCollect"
    >
      {{ collectCount }} {{ isCollected ? '已收藏' : '收藏' }}
    </el-button>

    <!-- 关注按钮 (仅用户类型) -->
    <el-button
      v-if="sourceType === 'user' && sourceId !== currentUser?.id"
      :type="isFollowed ? 'success' : 'default'"
      :icon="isFollowed ? 'user-check' : 'user-plus'"
      :loading="followingLoading"
      size="small"
      @click="toggleFollow"
    >
      {{ isFollowed ? '已关注' : '关注' }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { trpc } from '@/trpc/client'
import { useAuth } from '@/composables/useTRPC'
import { ElMessage } from 'element-plus'

interface Props {
  sourceId: string
  sourceType: 'article' | 'comment' | 'user'
  initialStats?: {
    like_count: number
    collect_count: number
    follow_count: number
  }
}

const props = defineProps<Props>()
const { user: currentUser, isAuthenticated } = useAuth()

// 状态管理
const likeCount = ref(props.initialStats?.like_count || 0)
const collectCount = ref(props.initialStats?.collect_count || 0)
const followCount = ref(props.initialStats?.follow_count || 0)

const isLiked = ref(false)
const isCollected = ref(false)
const isFollowed = ref(false)

const likingLoading = ref(false)
const collectingLoading = ref(false)
const followingLoading = ref(false)

// 获取用户状态
const checkUserActions = async () => {
  if (!isAuthenticated.value) return

  try {
    const actions = [
      {
        source_id: props.sourceId,
        source_type: props.sourceType,
        action_type: 'like' as const,
      },
      {
        source_id: props.sourceId,
        source_type: props.sourceType,
        action_type: 'collect' as const,
      },
    ]

    if (props.sourceType === 'user') {
      actions.push({
        source_id: props.sourceId,
        source_type: props.sourceType,
        action_type: 'follow' as const,
      })
    }

    const results = await trpc.praises.checkUserActions.query(actions)

    isLiked.value =
      results[`${props.sourceId}_${props.sourceType}_like`] || false
    isCollected.value =
      results[`${props.sourceId}_${props.sourceType}_collect`] || false

    if (props.sourceType === 'user') {
      isFollowed.value =
        results[`${props.sourceId}_${props.sourceType}_follow`] || false
    }
  } catch (error: any) {
    console.warn('获取用户操作状态失败:', error.message)
  }
}

// 切换点赞
const toggleLike = async () => {
  if (!isAuthenticated.value) {
    ElMessage.warning('请先登录')
    return
  }

  likingLoading.value = true
  try {
    const result = await trpc.praises.toggle.mutate({
      source_id: props.sourceId,
      source_type: props.sourceType,
      action_type: 'like',
    })

    if (result.action === 'added') {
      isLiked.value = true
      likeCount.value++
    } else {
      isLiked.value = false
      likeCount.value = Math.max(0, likeCount.value - 1)
    }

    ElMessage.success(result.message)
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    likingLoading.value = false
  }
}

// 切换收藏
const toggleCollect = async () => {
  if (!isAuthenticated.value) {
    ElMessage.warning('请先登录')
    return
  }

  collectingLoading.value = true
  try {
    const result = await trpc.praises.toggle.mutate({
      source_id: props.sourceId,
      source_type: props.sourceType,
      action_type: 'collect',
    })

    if (result.action === 'added') {
      isCollected.value = true
      collectCount.value++
    } else {
      isCollected.value = false
      collectCount.value = Math.max(0, collectCount.value - 1)
    }

    ElMessage.success(result.message)
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    collectingLoading.value = false
  }
}

// 切换关注
const toggleFollow = async () => {
  if (!isAuthenticated.value) {
    ElMessage.warning('请先登录')
    return
  }

  followingLoading.value = true
  try {
    const result = await trpc.praises.toggle.mutate({
      source_id: props.sourceId,
      source_type: props.sourceType,
      action_type: 'follow',
    })

    if (result.action === 'added') {
      isFollowed.value = true
      followCount.value++
    } else {
      isFollowed.value = false
      followCount.value = Math.max(0, followCount.value - 1)
    }

    ElMessage.success(result.message)
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    followingLoading.value = false
  }
}

// 监听认证状态变化
watch(
  isAuthenticated,
  newVal => {
    if (newVal) {
      checkUserActions()
    } else {
      // 用户退出登录时重置状态
      isLiked.value = false
      isCollected.value = false
      isFollowed.value = false
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.praise-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.praise-buttons .el-button {
  border-radius: 16px;
}
</style>
```

## ❓ 遇到的问题

### 问题 1：重复点赞的防护机制

**问题描述**：用户可能快速多次点击导致重复请求  
**解决方案**：

1. 前端按钮加载状态防止重复点击
2. 数据库唯一约束防止重复记录
3. 后端幂等性设计

### 问题 2：计数一致性问题

**问题描述**：点赞数与实际点赞记录可能不一致  
**解决方案**：

```sql
-- 定期修复计数脚本
UPDATE articles SET like_count = (
  SELECT COUNT(*) FROM praises
  WHERE source_id = articles.id
    AND source_type = 'article'
    AND action_type = 'like'
);
```

### 问题 3：大量数据的性能优化

**问题描述**：热门内容的点赞查询性能问题  
**解决方案**：

- 合理的索引设计
- 缓存热门数据
- 分页查询优化

## 💡 个人心得

### 今天最大的收获

设计了统一的点赞收藏系统，理解了如何用一张表优雅地处理多种互动行为，避免了表结构冗余。

### 系统设计的关键思考

1. **统一性优于分散性**：一个设计良好的统一表比多个功能表更易维护
2. **唯一约束的重要性**：防止重复数据的最后一道防线
3. **前后端状态同步**：确保用户界面与数据库状态一致

## 📋 行动清单

### 今日完成

- [x] 设计统一的 praises 表结构
- [x] 实现完整的点赞收藏 tRPC procedures
- [x] 创建前端点赞收藏组件
- [x] 处理防重复点赞和状态同步

### 明日预习

- [ ] 了解文件上传的处理方式
- [ ] 思考头像和图片存储方案
- [ ] 准备 Cloudflare R2 的集成

## 🔗 有用链接

- [数据库唯一约束最佳实践](https://www.sqlite.org/lang_createtable.html#unique_constraints)
- [防重复提交解决方案](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)
- [Vue 3 响应式状态管理](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)

---

**📝 明日重点**：实现文件上传功能，集成 Cloudflare R2 存储服务。
