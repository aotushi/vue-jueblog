# Day 19: 用户个人资料管理

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 完善用户资料编辑功能
- [ ] 实现用户统计信息展示
- [ ] 创建个人中心页面组件
- [ ] 测试资料更新和头像上传

## 📚 学习笔记

### 用户个人资料系统设计

#### 用户资料数据模型

```sql
-- 用户基本信息 (已存在，需要完善)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,        -- 登录凭证
  username TEXT NOT NULL,             -- 显示昵称
  password TEXT NOT NULL,             -- 加密密码
  avatar TEXT DEFAULT '',             -- 头像URL
  introduc TEXT DEFAULT '',           -- 个人介绍
  position TEXT DEFAULT '',           -- 职位
  company TEXT DEFAULT '',            -- 公司
  location TEXT DEFAULT '',           -- 所在地
  website TEXT DEFAULT '',            -- 个人网站
  github TEXT DEFAULT '',             -- GitHub链接
  jue_power INTEGER DEFAULT 0,        -- 掘金力值
  good_num INTEGER DEFAULT 0,         -- 获得点赞数
  read_num INTEGER DEFAULT 0,         -- 文章阅读数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户统计表 (实时计算的冗余存储)
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY,
  article_count INTEGER DEFAULT 0,    -- 文章总数
  published_count INTEGER DEFAULT 0,  -- 已发布文章数
  draft_count INTEGER DEFAULT 0,      -- 草稿数
  total_views INTEGER DEFAULT 0,      -- 总浏览量
  total_likes INTEGER DEFAULT 0,      -- 总点赞数
  total_comments INTEGER DEFAULT 0,   -- 总评论数
  follower_count INTEGER DEFAULT 0,   -- 粉丝数
  following_count INTEGER DEFAULT 0,  -- 关注数
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 个人资料功能模块

```
个人中心功能架构:
├── 基本资料编辑
│   ├── 头像上传
│   ├── 昵称修改
│   ├── 个人简介
│   └── 联系方式
├── 统计信息展示
│   ├── 文章数据
│   ├── 互动数据
│   └── 成就展示
├── 隐私设置
│   ├── 资料可见性
│   ├── 消息接收
│   └── 账号安全
└── 内容管理
    ├── 我的文章
    ├── 我的收藏
    └── 我的关注
```

### Zod Schema 定义

```typescript
// src/trpc/schemas/profile.ts
import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  username: z
    .string()
    .min(2, '昵称至少2个字符')
    .max(20, '昵称不超过20个字符')
    .optional(),
  introduc: z.string().max(200, '个人介绍不超过200个字符').optional(),
  position: z.string().max(50, '职位不超过50个字符').optional(),
  company: z.string().max(50, '公司名称不超过50个字符').optional(),
  location: z.string().max(50, '所在地不超过50个字符').optional(),
  website: z.string().url('请输入有效的网站链接').optional().or(z.literal('')),
  github: z
    .string()
    .regex(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+$/, '请输入有效的GitHub链接')
    .optional()
    .or(z.literal('')),
})

export const UserStatsResponseSchema = z.object({
  user_id: z.string(),
  article_count: z.number(),
  published_count: z.number(),
  draft_count: z.number(),
  total_views: z.number(),
  total_likes: z.number(),
  total_comments: z.number(),
  follower_count: z.number(),
  following_count: z.number(),
  last_active: z.string(),
  updated_at: z.string(),
})

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  phone: z.string(),
  avatar: z.string(),
  introduc: z.string(),
  position: z.string(),
  company: z.string(),
  location: z.string(),
  website: z.string(),
  github: z.string(),
  jue_power: z.number(),
  good_num: z.number(),
  read_num: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  stats: UserStatsResponseSchema.optional(),
})

export type UpdateProfile = z.infer<typeof UpdateProfileSchema>
export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>
```

## 🛠️ 实践操作

### 步骤1：实现个人资料 tRPC Procedures

```typescript
// src/trpc/profile.ts
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from './router'
import { TRPCError } from '@trpc/server'
import { UpdateProfileSchema } from './schemas/profile'

export const profileRouter = router({
  // 获取当前用户完整资料
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    // 获取用户基本信息
    const user = await ctx.env.DB.prepare(
      `
        SELECT * FROM users WHERE id = ?
      `,
    )
      .bind(userId)
      .first()

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '用户不存在',
      })
    }

    // 获取或创建用户统计信息
    let stats = await ctx.env.DB.prepare(
      `
        SELECT * FROM user_stats WHERE user_id = ?
      `,
    )
      .bind(userId)
      .first()

    if (!stats) {
      // 创建初始统计记录
      await ctx.env.DB.prepare(
        `
          INSERT INTO user_stats (user_id, updated_at)
          VALUES (?, datetime('now'))
        `,
      )
        .bind(userId)
        .run()

      stats = await ctx.env.DB.prepare(
        `
          SELECT * FROM user_stats WHERE user_id = ?
        `,
      )
        .bind(userId)
        .first()
    }

    // 排除密码字段
    const { password, ...userProfile } = user

    return {
      ...userProfile,
      stats,
    }
  }),

  // 获取其他用户的公开资料
  getUserProfile: publicProcedure
    .input(z.string().uuid('无效的用户ID'))
    .query(async ({ input: userId, ctx }) => {
      // 获取用户基本信息（排除敏感字段）
      const user = await ctx.env.DB.prepare(
        `
        SELECT 
          id, username, avatar, introduc, position, 
          company, location, website, github,
          jue_power, good_num, read_num, created_at
        FROM users 
        WHERE id = ?
      `,
      )
        .bind(userId)
        .first()

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '用户不存在',
        })
      }

      // 获取用户统计信息
      const stats = await ctx.env.DB.prepare(
        `
        SELECT 
          article_count, published_count,
          total_views, total_likes, total_comments,
          follower_count, following_count
        FROM user_stats 
        WHERE user_id = ?
      `,
      )
        .bind(userId)
        .first()

      return {
        ...user,
        stats: stats || {
          article_count: 0,
          published_count: 0,
          total_views: 0,
          total_likes: 0,
          total_comments: 0,
          follower_count: 0,
          following_count: 0,
        },
      }
    }),

  // 更新个人资料
  updateProfile: protectedProcedure
    .input(UpdateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id

      // 检查用户名是否已被占用
      if (input.username) {
        const existingUser = await ctx.env.DB.prepare(
          `
          SELECT id FROM users WHERE username = ? AND id != ?
        `,
        )
          .bind(input.username, userId)
          .first()

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '用户名已被占用',
          })
        }
      }

      // 构建更新语句
      const updateFields = []
      const updateValues = []

      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`)
          updateValues.push(value)
        }
      })

      if (updateFields.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '没有需要更新的字段',
        })
      }

      // 添加更新时间
      updateFields.push("updated_at = datetime('now')")
      updateValues.push(userId)

      try {
        await ctx.env.DB.prepare(
          `
          UPDATE users 
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `,
        )
          .bind(...updateValues)
          .run()

        return { message: '资料更新成功' }
      } catch (error) {
        console.error('更新用户资料失败:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '更新失败',
        })
      }
    }),

  // 刷新用户统计信息
  refreshStats: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id

    try {
      // 计算文章统计
      const articleStats = await ctx.env.DB.prepare(
        `
          SELECT 
            COUNT(*) as article_count,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_count,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
            SUM(view_count) as total_views,
            SUM(like_count) as total_likes,
            SUM(comment_count) as total_comments
          FROM articles 
          WHERE author_id = ?
        `,
      )
        .bind(userId)
        .first()

      // 计算关注统计
      const followStats = await ctx.env.DB.prepare(
        `
          SELECT 
            (SELECT COUNT(*) FROM praises WHERE source_id = ? AND source_type = 'user' AND action_type = 'follow') as follower_count,
            (SELECT COUNT(*) FROM praises WHERE user_id = ? AND source_type = 'user' AND action_type = 'follow') as following_count
        `,
      )
        .bind(userId, userId)
        .first()

      // 更新统计表
      await ctx.env.DB.prepare(
        `
          INSERT OR REPLACE INTO user_stats (
            user_id, article_count, published_count, draft_count,
            total_views, total_likes, total_comments,
            follower_count, following_count,
            last_active, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      )
        .bind(
          userId,
          articleStats.article_count || 0,
          articleStats.published_count || 0,
          articleStats.draft_count || 0,
          articleStats.total_views || 0,
          articleStats.total_likes || 0,
          articleStats.total_comments || 0,
          followStats.follower_count || 0,
          followStats.following_count || 0,
        )
        .run()

      return { message: '统计信息刷新成功' }
    } catch (error) {
      console.error('刷新统计信息失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: '刷新失败',
      })
    }
  }),

  // 获取用户活动时间线
  getActivityTimeline: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        size: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { page, size } = input
      const userId = ctx.user.id
      const offset = (page - 1) * size

      // 获取用户活动记录（文章发布、点赞、评论等）
      const activities = await ctx.env.DB.prepare(
        `
        SELECT 
          'article' as type,
          'published' as action,
          a.id as target_id,
          a.title as content,
          a.published_at as created_at
        FROM articles a
        WHERE a.author_id = ? AND a.status = 'published'
        
        UNION ALL
        
        SELECT 
          'praise' as type,
          p.action_type as action,
          p.source_id as target_id,
          CASE 
            WHEN p.source_type = 'article' THEN (SELECT title FROM articles WHERE id = p.source_id)
            ELSE p.source_type
          END as content,
          p.created_at
        FROM praises p
        WHERE p.user_id = ?
        
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      )
        .bind(userId, userId, size, offset)
        .all()

      const { total } = await ctx.env.DB.prepare(
        `
        SELECT COUNT(*) as total FROM (
          SELECT created_at FROM articles WHERE author_id = ? AND status = 'published'
          UNION ALL
          SELECT created_at FROM praises WHERE user_id = ?
        )
      `,
      )
        .bind(userId, userId)
        .first()

      return {
        activities: activities.results,
        pagination: {
          page,
          size,
          total: total as number,
          totalPages: Math.ceil((total as number) / size),
        },
      }
    }),
})
```

### 步骤2：创建个人中心页面组件

```vue
<!-- src/views/Profile.vue -->
<template>
  <div class="profile-container">
    <el-card class="profile-header">
      <div class="profile-info">
        <!-- 头像区域 -->
        <div class="avatar-section">
          <el-avatar :size="100" :src="userProfile?.avatar" class="avatar">
            {{ userProfile?.username?.[0] }}
          </el-avatar>

          <FileUpload
            v-if="isOwner"
            type="avatar"
            class="avatar-upload"
            @success="handleAvatarSuccess"
          >
            <template #trigger>
              <el-button size="small" type="primary">更换头像</el-button>
            </template>
          </FileUpload>
        </div>

        <!-- 用户信息 -->
        <div class="user-info">
          <h2>{{ userProfile?.username }}</h2>
          <p class="intro">
            {{ userProfile?.introduc || '这个人很懒，什么都没留下' }}
          </p>

          <div class="user-details">
            <span v-if="userProfile?.position" class="detail-item">
              <el-icon><Briefcase /></el-icon>
              {{ userProfile.position }}
              <span v-if="userProfile.company">@{{ userProfile.company }}</span>
            </span>

            <span v-if="userProfile?.location" class="detail-item">
              <el-icon><Location /></el-icon>
              {{ userProfile.location }}
            </span>

            <span v-if="userProfile?.website" class="detail-item">
              <el-icon><Link /></el-icon>
              <a :href="userProfile.website" target="_blank">个人网站</a>
            </span>

            <span v-if="userProfile?.github" class="detail-item">
              <el-icon><Link /></el-icon>
              <a :href="userProfile.github" target="_blank">GitHub</a>
            </span>
          </div>

          <div class="join-date">
            加入时间：{{ formatDate(userProfile?.created_at) }}
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <el-button
            v-if="isOwner"
            type="primary"
            @click="showEditDialog = true"
          >
            编辑资料
          </el-button>

          <PraiseButton
            v-else-if="userProfile"
            :source-id="userProfile.id"
            source-type="user"
          />
        </div>
      </div>
    </el-card>

    <!-- 统计信息 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">
            {{ userProfile?.stats?.published_count || 0 }}
          </div>
          <div class="stat-label">发布文章</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">
            {{ userProfile?.stats?.total_views || 0 }}
          </div>
          <div class="stat-label">文章阅读</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">
            {{ userProfile?.stats?.total_likes || 0 }}
          </div>
          <div class="stat-label">获得点赞</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-number">
            {{ userProfile?.stats?.follower_count || 0 }}
          </div>
          <div class="stat-label">粉丝数量</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 内容标签页 -->
    <el-card class="content-tabs">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="文章" name="articles">
          <UserArticleList :user-id="userId" />
        </el-tab-pane>

        <el-tab-pane v-if="isOwner" label="草稿" name="drafts">
          <UserArticleList :user-id="userId" status="draft" />
        </el-tab-pane>

        <el-tab-pane label="动态" name="activity">
          <UserActivityList :user-id="userId" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 编辑资料对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑个人资料" width="600px">
      <ProfileEditForm
        :initial-data="userProfile"
        @success="handleProfileUpdate"
        @cancel="showEditDialog = false"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { trpc } from '@/trpc/client'
import { useAuth } from '@/composables/useTRPC'
import { ElMessage } from 'element-plus'
import { Briefcase, Location, Link } from '@element-plus/icons-vue'
import FileUpload from '@/components/FileUpload.vue'
import PraiseButton from '@/components/PraiseButton.vue'
import UserArticleList from '@/components/UserArticleList.vue'
import UserActivityList from '@/components/UserActivityList.vue'
import ProfileEditForm from '@/components/ProfileEditForm.vue'

const route = useRoute()
const { user: currentUser } = useAuth()

const userId = computed(() => {
  return (route.params.id as string) || currentUser.value?.id
})

const isOwner = computed(() => {
  return currentUser.value?.id === userId.value
})

const userProfile = ref(null)
const loading = ref(false)
const showEditDialog = ref(false)
const activeTab = ref('articles')

const loadUserProfile = async () => {
  if (!userId.value) return

  loading.value = true
  try {
    if (isOwner.value) {
      userProfile.value = await trpc.profile.getMyProfile.query()
    } else {
      userProfile.value = await trpc.profile.getUserProfile.query(userId.value)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载用户信息失败')
  } finally {
    loading.value = false
  }
}

const handleAvatarSuccess = (url: string) => {
  if (userProfile.value) {
    userProfile.value.avatar = url
  }
  ElMessage.success('头像更新成功')
}

const handleProfileUpdate = () => {
  showEditDialog.value = false
  loadUserProfile()
  ElMessage.success('资料更新成功')
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadUserProfile()
})
</script>

<style scoped>
.profile-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.profile-header {
  margin-bottom: 20px;
}

.profile-info {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.avatar-section {
  text-align: center;
}

.avatar {
  margin-bottom: 12px;
}

.user-info {
  flex: 1;
}

.user-info h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.intro {
  color: #666;
  margin-bottom: 16px;
  font-size: 14px;
}

.user-details {
  margin-bottom: 12px;
}

.detail-item {
  display: inline-flex;
  align-items: center;
  margin-right: 16px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.detail-item .el-icon {
  margin-right: 4px;
}

.detail-item a {
  color: #409eff;
  text-decoration: none;
}

.join-date {
  font-size: 12px;
  color: #999;
}

.actions {
  align-self: flex-start;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.content-tabs :deep(.el-tabs__content) {
  margin-top: 20px;
}
</style>
```

## 🔍 深入思考

### 用户体验优化

#### 响应式数据更新

```typescript
// 实时更新统计数据
const useUserStats = (userId: string) => {
  const stats = ref(null)

  const refreshStats = async () => {
    try {
      await trpc.profile.refreshStats.mutate()
      // 重新获取最新数据
      const updated = await trpc.profile.getMyProfile.query()
      stats.value = updated.stats
    } catch (error) {
      console.error('更新统计失败:', error)
    }
  }

  // 监听用户操作，自动刷新统计
  const scheduleRefresh = debounce(refreshStats, 5000)

  return {
    stats,
    refreshStats: scheduleRefresh,
  }
}
```

#### 头像上传优化

```typescript
// 头像上传预处理
const processAvatarUpload = async (file: File) => {
  // 压缩图片到合适尺寸
  const compressedFile = await compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.8,
  })

  // 生成缩略图
  const thumbnail = await generateThumbnail(compressedFile, {
    width: 64,
    height: 64,
  })

  return { compressedFile, thumbnail }
}
```

## ❓ 遇到的问题

### 问题 1：统计数据一致性

**问题描述**：用户统计数据可能与实际数据不一致  
**解决方案**：

1. 定时任务刷新统计数据
2. 关键操作后触发统计更新
3. 提供手动刷新功能

### 问题 2：头像上传失败处理

**问题描述**：头像上传失败后UI状态不正确  
**解决方案**：

```typescript
const handleAvatarUpload = async (file: File) => {
  const oldAvatar = userProfile.value?.avatar

  try {
    // 乐观更新：先显示预览
    userProfile.value.avatar = URL.createObjectURL(file)

    const result = await uploadAvatar(file)
    userProfile.value.avatar = result.url
  } catch (error) {
    // 失败时回滚
    userProfile.value.avatar = oldAvatar
    ElMessage.error('头像上传失败')
  }
}
```

## 💡 个人心得

### 今天最大的收获

完成了用户个人资料管理系统，理解了如何设计用户中心的完整功能和数据流。

### 个人中心设计的关键点

1. **数据分层**：基本资料 + 统计信息的分离存储
2. **权限控制**：自己和他人的资料显示差异
3. **实时更新**：统计数据的及时刷新机制
4. **用户体验**：乐观更新和错误回滚

## 📋 行动清单

### 今日完成

- [x] 设计用户资料和统计数据模型
- [x] 实现个人资料相关 tRPC procedures
- [x] 创建个人中心页面组件
- [x] 处理头像上传和资料编辑功能

### 明日预习

- [ ] 了解数据迁移工具的设计
- [ ] 思考 MongoDB 到 D1 的数据映射
- [ ] 准备批量数据处理策略

## 🔗 有用链接

- [Vue 3 组合式 API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [用户体验设计原则](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [头像上传最佳实践](https://web.dev/image-optimization/)

---

**📝 明日重点**：开始数据迁移工具开发，实现 MongoDB 数据导出功能。
