# Day 23: 前端架构现代化重构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 重构前端项目结构，引入现代化架构模式
- [ ] 配置 Vue 3 Composition API 最佳实践
- [ ] 实现响应式状态管理系统升级
- [ ] 优化组件设计和代码组织结构

## 📚 学习笔记

### Vue 3 现代化架构设计

#### 组合式 API 最佳实践

```typescript
// src/composables/useAuth.ts
import { ref, computed, readonly } from 'vue'
import { trpc } from '@/trpc/client'

interface User {
  id: string
  username: string
  avatar: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// 全局认证状态
const authState = ref<AuthState>({
  user: null,
  token: localStorage.getItem('auth-token'),
  isAuthenticated: false,
})

export const useAuth = () => {
  // 计算属性
  const isAuthenticated = computed(() => !!authState.value.user)
  const currentUser = computed(() => authState.value.user)

  // 登录方法
  const login = async (phone: string, password: string) => {
    try {
      const result = await trpc.auth.login.mutate({ phone, password })

      authState.value = {
        user: result.user,
        token: result.token,
        isAuthenticated: true,
      }

      localStorage.setItem('auth-token', result.token)
      return { success: true, user: result.user }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 注销方法
  const logout = () => {
    authState.value = {
      user: null,
      token: null,
      isAuthenticated: false,
    }
    localStorage.removeItem('auth-token')
  }

  // 初始化认证状态
  const initAuth = async () => {
    const token = authState.value.token
    if (!token) return

    try {
      const user = await trpc.auth.me.query()
      authState.value.user = user
      authState.value.isAuthenticated = true
    } catch (error) {
      logout() // token 无效时自动登出
    }
  }

  // 更新用户信息
  const updateUser = (userData: Partial<User>) => {
    if (authState.value.user) {
      authState.value.user = { ...authState.value.user, ...userData }
    }
  }

  return {
    // 只读状态
    user: readonly(currentUser),
    isAuthenticated: readonly(isAuthenticated),

    // 方法
    login,
    logout,
    initAuth,
    updateUser,
  }
}
```

#### 现代化项目结构设计

```
src/
├── components/           # 可复用组件
│   ├── ui/              # 基础 UI 组件
│   │   ├── Button.vue
│   │   ├── Input.vue
│   │   └── Modal.vue
│   ├── business/        # 业务组件
│   │   ├── ArticleCard.vue
│   │   ├── CommentList.vue
│   │   └── UserProfile.vue
│   └── layout/          # 布局组件
│       ├── AppHeader.vue
│       ├── AppSidebar.vue
│       └── AppFooter.vue
├── composables/         # 可复用逻辑
│   ├── useAuth.ts
│   ├── useArticles.ts
│   ├── usePagination.ts
│   └── useTheme.ts
├── stores/              # Pinia 状态管理
│   ├── auth.ts
│   ├── articles.ts
│   └── ui.ts
├── utils/               # 工具函数
│   ├── format.ts
│   ├── validation.ts
│   └── helpers.ts
├── types/               # TypeScript 类型定义
│   ├── api.ts
│   ├── user.ts
│   └── article.ts
└── trpc/                # tRPC 客户端
    ├── client.ts
    └── types.ts
```

### 状态管理现代化

#### Pinia 替代 Vuex

```typescript
// src/stores/articles.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trpc } from '@/trpc/client'

export interface Article {
  id: string
  title: string
  content: string
  summary: string
  author_id: string
  status: 'draft' | 'published'
  view_count: number
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
  tags: string[]
}

export const useArticlesStore = defineStore('articles', () => {
  // 状态
  const articles = ref<Article[]>([])
  const currentArticle = ref<Article | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 分页状态
  const pagination = ref({
    page: 1,
    size: 20,
    total: 0,
    totalPages: 0,
  })

  // 计算属性
  const publishedArticles = computed(() =>
    articles.value.filter(article => article.status === 'published'),
  )

  const draftArticles = computed(() =>
    articles.value.filter(article => article.status === 'draft'),
  )

  const totalWords = computed(() =>
    articles.value.reduce(
      (total, article) => total + article.content.length,
      0,
    ),
  )

  // Actions
  const fetchArticles = async (
    params: {
      page?: number
      size?: number
      status?: string
      author_id?: string
    } = {},
  ) => {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.articles.list.query({
        page: params.page || pagination.value.page,
        size: params.size || pagination.value.size,
        status: params.status,
        author_id: params.author_id,
      })

      articles.value = result.articles
      pagination.value = result.pagination
    } catch (err: any) {
      error.value = err.message
      console.error('获取文章列表失败:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchArticleById = async (id: string) => {
    loading.value = true
    error.value = null

    try {
      const article = await trpc.articles.getById.query(id)
      currentArticle.value = article

      // 更新列表中的对应文章
      const index = articles.value.findIndex(a => a.id === id)
      if (index !== -1) {
        articles.value[index] = article
      }

      return article
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const createArticle = async (
    articleData: Omit<Article, 'id' | 'created_at' | 'updated_at'>,
  ) => {
    loading.value = true
    error.value = null

    try {
      const newArticle = await trpc.articles.create.mutate(articleData)
      articles.value.unshift(newArticle)
      return newArticle
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateArticle = async (id: string, updates: Partial<Article>) => {
    loading.value = true
    error.value = null

    try {
      const updatedArticle = await trpc.articles.update.mutate({
        id,
        ...updates,
      })

      // 更新本地状态
      const index = articles.value.findIndex(a => a.id === id)
      if (index !== -1) {
        articles.value[index] = { ...articles.value[index], ...updatedArticle }
      }

      if (currentArticle.value?.id === id) {
        currentArticle.value = { ...currentArticle.value, ...updatedArticle }
      }

      return updatedArticle
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteArticle = async (id: string) => {
    loading.value = true
    error.value = null

    try {
      await trpc.articles.delete.mutate(id)

      // 从列表中移除
      articles.value = articles.value.filter(a => a.id !== id)

      if (currentArticle.value?.id === id) {
        currentArticle.value = null
      }

      // 更新分页信息
      pagination.value.total = Math.max(0, pagination.value.total - 1)
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 清理状态
  const $reset = () => {
    articles.value = []
    currentArticle.value = null
    loading.value = false
    error.value = null
    pagination.value = {
      page: 1,
      size: 20,
      total: 0,
      totalPages: 0,
    }
  }

  return {
    // 状态
    articles: readonly(articles),
    currentArticle: readonly(currentArticle),
    loading: readonly(loading),
    error: readonly(error),
    pagination: readonly(pagination),

    // 计算属性
    publishedArticles,
    draftArticles,
    totalWords,

    // Actions
    fetchArticles,
    fetchArticleById,
    createArticle,
    updateArticle,
    deleteArticle,
    $reset,
  }
})
```

### TypeScript 类型系统优化

#### 完善的类型定义

```typescript
// src/types/api.ts
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  code?: number
}

export interface PaginationParams {
  page: number
  size: number
}

export interface PaginationResponse {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface ListResponse<T> {
  items: T[]
  pagination: PaginationResponse
}

// src/types/user.ts
export interface User {
  id: string
  phone: string
  username: string
  avatar: string
  introduc: string
  position: string
  company: string
  location: string
  website: string
  github: string
  jue_power: number
  good_num: number
  read_num: number
  created_at: string
  updated_at: string
}

export interface UserStats {
  user_id: string
  article_count: number
  published_count: number
  draft_count: number
  total_views: number
  total_likes: number
  total_comments: number
  follower_count: number
  following_count: number
  last_active: string
  updated_at: string
}

export interface CreateUserDto {
  phone: string
  username: string
  password: string
}

export interface UpdateUserDto {
  username?: string
  introduc?: string
  position?: string
  company?: string
  location?: string
  website?: string
  github?: string
}

// src/types/article.ts
export interface Article {
  id: string
  title: string
  content: string
  summary: string
  author_id: string
  status: ArticleStatus
  view_count: number
  like_count: number
  comment_count: number
  collect_count: number
  created_at: string
  updated_at: string
  published_at: string | null
}

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface ArticleWithAuthor extends Article {
  author: {
    id: string
    username: string
    avatar: string
  }
}

export interface CreateArticleDto {
  title: string
  content: string
  summary?: string
  status?: ArticleStatus
  tags?: string[]
}

export interface UpdateArticleDto {
  title?: string
  content?: string
  summary?: string
  status?: ArticleStatus
}
```

## 🛠️ 实践操作

### 步骤1：重构组件结构

```vue
<!-- src/components/business/ArticleCard.vue -->
<template>
  <article class="article-card" @click="navigateToArticle">
    <!-- 文章封面 -->
    <div v-if="article.cover" class="article-cover">
      <img :src="article.cover" :alt="article.title" loading="lazy" />
    </div>

    <!-- 文章内容 -->
    <div class="article-content">
      <header class="article-header">
        <h3 class="article-title">{{ article.title }}</h3>
        <div class="article-meta">
          <UserAvatar :user="article.author" size="small" :show-name="true" />
          <time class="publish-time">
            {{ formatRelativeTime(article.published_at) }}
          </time>
        </div>
      </header>

      <div class="article-summary">
        {{ article.summary }}
      </div>

      <footer class="article-footer">
        <div class="article-stats">
          <StatItem icon="eye" :count="article.view_count" />
          <StatItem icon="heart" :count="article.like_count" />
          <StatItem icon="message-circle" :count="article.comment_count" />
        </div>

        <div class="article-tags">
          <Tag
            v-for="tag in article.tags"
            :key="tag"
            :label="tag"
            size="small"
          />
        </div>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ArticleWithAuthor } from '@/types/article'
import { formatRelativeTime } from '@/utils/format'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import StatItem from '@/components/ui/StatItem.vue'
import Tag from '@/components/ui/Tag.vue'

interface Props {
  article: ArticleWithAuthor
}

interface Emits {
  (e: 'click', article: ArticleWithAuthor): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()

const navigateToArticle = () => {
  emit('click', props.article)
  router.push(`/articles/${props.article.id}`)
}
</script>

<style scoped>
.article-card {
  @apply bg-white rounded-lg border border-gray-200 overflow-hidden 
         hover:shadow-md transition-all duration-200 cursor-pointer
         hover:border-gray-300;
}

.article-cover img {
  @apply w-full h-48 object-cover;
}

.article-content {
  @apply p-6;
}

.article-header {
  @apply mb-3;
}

.article-title {
  @apply text-lg font-semibold text-gray-900 mb-2 
         line-clamp-2 hover:text-blue-600 transition-colors;
}

.article-meta {
  @apply flex items-center justify-between text-sm text-gray-500;
}

.article-summary {
  @apply text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3;
}

.article-footer {
  @apply flex items-center justify-between;
}

.article-stats {
  @apply flex items-center gap-4;
}

.article-tags {
  @apply flex items-center gap-2;
}
</style>
```

### 步骤2：优化路由结构

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import type { RouteRecordRaw } from 'vue-router'

// 路由懒加载
const Home = () => import('@/views/Home.vue')
const Articles = () => import('@/views/Articles.vue')
const ArticleDetail = () => import('@/views/ArticleDetail.vue')
const Profile = () => import('@/views/Profile.vue')
const Dashboard = () => import('@/views/Dashboard.vue')

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: '首页' },
  },
  {
    path: '/articles',
    name: 'Articles',
    component: Articles,
    meta: { title: '文章列表' },
  },
  {
    path: '/articles/:id',
    name: 'ArticleDetail',
    component: ArticleDetail,
    meta: { title: '文章详情' },
    props: true,
  },
  {
    path: '/profile/:id?',
    name: 'Profile',
    component: Profile,
    meta: { title: '用户资料' },
    props: true,
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      title: '个人中心',
      requiresAuth: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    } else {
      return { top: 0, behavior: 'smooth' }
    }
  },
})

// 全局路由守卫
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated } = useAuth()

  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - Vue 博客`
  }

  // 检查认证要求
  if (to.meta?.requiresAuth && !isAuthenticated.value) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  next()
})

export default router
```

### 步骤3：实现主题系统

```typescript
// src/composables/useTheme.ts
import { ref, computed, watchEffect } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'vue-blog-theme'

// 主题状态
const currentTheme = ref<Theme>('system')

// 系统主题检测
const systemTheme = ref<'light' | 'dark'>('light')

// 实际应用的主题
const appliedTheme = computed(() => {
  if (currentTheme.value === 'system') {
    return systemTheme.value
  }
  return currentTheme.value
})

export const useTheme = () => {
  // 检测系统主题变化
  const updateSystemTheme = () => {
    systemTheme.value = window.matchMedia('(prefers-color-scheme: dark)')
      .matches
      ? 'dark'
      : 'light'
  }

  // 应用主题到 DOM
  const applyTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement

    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  // 设置主题
  const setTheme = (theme: Theme) => {
    currentTheme.value = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }

  // 初始化主题
  const initTheme = () => {
    // 从本地存储恢复主题设置
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    if (savedTheme) {
      currentTheme.value = savedTheme
    }

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)

    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }

  // 监听主题变化并应用
  watchEffect(() => {
    applyTheme(appliedTheme.value)
  })

  return {
    currentTheme: computed(() => currentTheme.value),
    appliedTheme,
    setTheme,
    initTheme,

    // 便捷方法
    isDark: computed(() => appliedTheme.value === 'dark'),
    isLight: computed(() => appliedTheme.value === 'light'),
    toggleTheme: () => {
      const newTheme = appliedTheme.value === 'dark' ? 'light' : 'dark'
      setTheme(newTheme)
    },
  }
}
```

## 🔍 深入思考

### 现代化架构的核心优势

1. **类型安全**：TypeScript + 严格类型检查
2. **响应式编程**：Composition API + 细粒度响应
3. **状态管理**：Pinia 替代 Vuex，更简洁的 API
4. **代码组织**：按功能模块化，提高可维护性
5. **性能优化**：按需加载、组件缓存、计算属性优化

### 架构设计原则

```typescript
// 1. 单一职责原则 - 每个组合函数专注一个功能
const useAuth = () => {
  /* 只处理认证 */
}
const useArticles = () => {
  /* 只处理文章 */
}
const useTheme = () => {
  /* 只处理主题 */
}

// 2. 依赖注入 - 通过 provide/inject 实现
const app = createApp(App)
app.provide('trpcClient', trpcClient)
app.provide('httpClient', axios)

// 3. 接口隔离 - 精确的 TypeScript 接口
interface UserRepository {
  findById(id: string): Promise<User>
  create(data: CreateUserDto): Promise<User>
  update(id: string, data: UpdateUserDto): Promise<User>
}

// 4. 开放封闭 - 通过插件系统扩展
const plugin = {
  install(app: App) {
    app.config.globalProperties.$notify = notify
  },
}
```

## ❓ 遇到的问题

### 问题 1：Composition API 与 Options API 混用

**问题描述**：团队成员对新语法不熟悉，代码风格不统一  
**解决方案**：

```typescript
// 建立代码规范和 ESLint 规则
// .eslintrc.js
module.exports = {
  rules: {
    // 强制使用 Composition API
    'vue/prefer-composition-api': 'error',
    // 禁用 Options API 的某些选项
    'vue/no-deprecated-data-object-declaration': 'error',
  },
}

// 提供迁移指南和最佳实践示例
const migrationGuide = {
  data: '使用 ref() 或 reactive()',
  methods: '直接定义函数',
  computed: '使用 computed()',
  watch: '使用 watch() 或 watchEffect()',
}
```

### 问题 2：状态管理复杂度增加

**问题描述**：多个 store 之间的依赖关系复杂  
**解决方案**：

```typescript
// 建立清晰的依赖关系图
const storeDependencies = {
  auth: [], // 无依赖
  articles: ['auth'], // 依赖认证
  comments: ['auth', 'articles'], // 依赖认证和文章
  ui: [], // UI 状态独立
}

// 使用组合式 store 减少耦合
export const useArticlesStore = defineStore('articles', () => {
  const authStore = useAuthStore() // 显式声明依赖
  // ...
})
```

### 问题 3：类型定义维护成本

**问题描述**：API 接口变化时需要同步更新多处类型定义  
**解决方案**：

```typescript
// 使用 tRPC 自动生成类型
import type { AppRouter } from '../backend/src/router'
import { createTRPCMsw } from '@trpc/msw'

// 类型安全的 API 调用
const user = await trpc.users.getById.query('123') // 自动推断类型

// 单一数据源的类型定义
export type ApiTypes = inferRouterInputs<AppRouter> &
  inferRouterOutputs<AppRouter>
```

## 💡 个人心得

### 今天最大的收获

成功建立了现代化的前端架构基础，理解了 Vue 3 + TypeScript + Pinia 的最佳实践模式。

### 架构升级的关键经验

1. **渐进式重构**：不要一次性重写所有代码，逐步迁移
2. **类型驱动开发**：先定义类型，再实现功能
3. **组合式思维**：将复杂逻辑分解为可复用的组合函数
4. **状态管理优化**：合理划分 store 边界，避免过度细分

## 📋 行动清单

### 今日完成

- [x] 重构项目组件结构，建立现代化目录组织
- [x] 实现基于 Composition API 的状态管理方案
- [x] 完善 TypeScript 类型系统定义
- [x] 建立主题系统和路由优化方案

### 明日预习

- [ ] 了解 Vite 构建优化策略
- [ ] 思考代码分割和懒加载方案
- [ ] 准备性能监控和错误追踪集成

## 🔗 有用链接

- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia 官方文档](https://pinia.vuejs.org/)
- [TypeScript 高级类型](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Vue Router 4](https://router.vuejs.org/)

---

**📝 明日重点**：优化前端构建配置，实现代码分割和性能监控。
