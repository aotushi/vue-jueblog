# Day 13: 前端 tRPC 客户端配置

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 安装前端 tRPC 依赖：`@trpc/client`, `@trpc/vue-query`
- [ ] 创建 `src/trpc/` 前端配置目录
- [ ] 配置 tRPC 客户端连接
- [ ] 移除部分 axios 依赖（保留用于渐进式迁移）

## 📚 学习笔记

### tRPC 前端集成策略

#### 渐进式迁移方案

```
Phase 1: 并存阶段
├── Axios (现有 API)     - 保留现有功能
└── tRPC (新 API)       - 新功能使用 tRPC

Phase 2: 逐步迁移
├── Axios (遗留 API)     - 逐步替换
└── tRPC (主要 API)     - 成为主力

Phase 3: 完全迁移
└── tRPC (唯一 API)     - 完全替换 Axios
```

#### Vue 3 + tRPC 集成方案

```typescript
// 两种主要集成方式
1. Vanilla Client: 直接使用 tRPC 客户端
2. Vue Query: 配合 @tanstack/vue-query 使用 (推荐)
```

### tRPC 客户端架构

#### 核心组件

```
tRPC Client
├── HTTP Link          - 网络传输层
├── Type Router        - 类型定义
├── Query Cache        - 查询缓存 (Vue Query)
└── Error Handling     - 错误处理
```

## 🛠️ 实践操作

### 步骤1：安装前端依赖

```bash
# 在项目根目录执行
npm install @trpc/client @tanstack/vue-query

# 开发依赖 (用于类型生成)
npm install -D @trpc/server

# 验证安装
npm list | grep trpc
```

**安装结果记录**：

```
@trpc/client: 版本 _____
@tanstack/vue-query: 版本 _____
安装是否成功: 成功/失败
```

### 步骤2：创建 tRPC 客户端配置

```typescript
// src/trpc/client.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../vue-blog-backend/src/trpc/router'

// 获取 API 基础 URL
const getBaseUrl = () => {
  // 开发环境
  if (import.meta.env.DEV) {
    return 'http://localhost:8787'
  }

  // 生产环境
  return 'https://api.yourdomain.com'
}

// 创建 tRPC 客户端
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,

      // 添加认证头
      headers: async () => {
        const token = localStorage.getItem('auth_token')
        return {
          authorization: token ? `Bearer ${token}` : '',
        }
      },

      // 批量请求配置
      maxURLLength: 2083,
    }),
  ],
})

// 导出类型 (用于其他文件的类型推断)
export type { AppRouter }
```

### 步骤3：配置 Vue Query (推荐方案)

```typescript
// src/trpc/vue-query.ts
import { createTRPCVueClient, httpBatchLink } from '@trpc/vue-query'
import type { AppRouter } from '../../../vue-blog-backend/src/trpc/router'

const getBaseUrl = () => {
  if (import.meta.env.DEV) return 'http://localhost:8787'
  return 'https://api.yourdomain.com'
}

export const trpc = createTRPCVueClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers: async () => {
        const token = localStorage.getItem('auth_token')
        return {
          authorization: token ? `Bearer ${token}` : '',
        }
      },
    }),
  ],
})
```

### 步骤4：在 Vue 应用中集成

```typescript
// src/main.ts
import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

const app = createApp(App)

// 配置 Vue Query
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 分钟
        cacheTime: 10 * 60 * 1000, // 10 分钟
        retry: (failureCount, error) => {
          // 401 错误不重试
          if (error?.data?.code === 'UNAUTHORIZED') return false
          return failureCount < 3
        },
      },
    },
  },
})

app.use(createPinia())
app.use(router)
app.mount('#app')
```

### 步骤5：创建 tRPC Composables

```typescript
// src/composables/useTRPC.ts
import { trpc } from '@/trpc/vue-query'
import { computed } from 'vue'

// 用户相关 composables
export function useAuth() {
  // 登录
  const loginMutation = trpc.users.login.useMutation({
    onSuccess: data => {
      // 存储 token
      localStorage.setItem('auth_token', data.token)
      // 重新获取用户信息
      userQuery.refetch()
    },
    onError: error => {
      console.error('登录失败:', error.message)
    },
  })

  // 注册
  const registerMutation = trpc.users.register.useMutation({
    onSuccess: data => {
      localStorage.setItem('auth_token', data.token)
    },
  })

  // 获取当前用户信息
  const userQuery = trpc.users.me.useQuery(undefined, {
    enabled: computed(() => !!localStorage.getItem('auth_token')),
    retry: false,
  })

  return {
    // 状态
    user: computed(() => userQuery.data.value),
    isLoggedIn: computed(() => !!userQuery.data.value),
    isLoading: computed(() => userQuery.isLoading.value),

    // 方法
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: () => {
      localStorage.removeItem('auth_token')
      userQuery.remove()
    },

    // 加载状态
    isLoginLoading: computed(() => loginMutation.isLoading.value),
    isRegisterLoading: computed(() => registerMutation.isLoading.value),
  }
}

// 文章相关 composables
export function useArticles() {
  // 文章列表查询
  const articlesQuery = trpc.articles.list.useQuery(
    { page: 1, size: 10 },
    {
      keepPreviousData: true, // 翻页时保持之前的数据
    },
  )

  // 创建文章
  const createArticleMutation = trpc.articles.create.useMutation({
    onSuccess: () => {
      // 重新获取文章列表
      articlesQuery.refetch()
    },
  })

  return {
    // 数据
    articles: computed(() => articlesQuery.data.value?.articles ?? []),
    pagination: computed(() => articlesQuery.data.value?.pagination),

    // 状态
    isLoading: computed(() => articlesQuery.isLoading.value),
    isError: computed(() => articlesQuery.isError.value),
    error: computed(() => articlesQuery.error.value),

    // 方法
    refetch: articlesQuery.refetch,
    createArticle: createArticleMutation.mutate,
    isCreating: computed(() => createArticleMutation.isLoading.value),
  }
}
```

### 步骤6：在组件中使用 tRPC

```vue
<!-- src/components/LoginForm.vue -->
<template>
  <form @submit.prevent="handleLogin">
    <el-input
      v-model="form.phone"
      placeholder="手机号"
      :disabled="isLoginLoading"
    />
    <el-input
      v-model="form.password"
      type="password"
      placeholder="密码"
      :disabled="isLoginLoading"
    />
    <el-button type="primary" native-type="submit" :loading="isLoginLoading">
      {{ isLoginLoading ? '登录中...' : '登录' }}
    </el-button>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useAuth } from '@/composables/useTRPC'
import { ElMessage } from 'element-plus'

const { login, isLoginLoading } = useAuth()

const form = reactive({
  phone: '',
  password: '',
})

const handleLogin = async () => {
  try {
    await login(form)
    ElMessage.success('登录成功')
  } catch (error: any) {
    ElMessage.error(error.message || '登录失败')
  }
}
</script>
```

### 步骤7：Pinia Store 集成 tRPC

```typescript
// src/stores/user.ts (更新现有 store)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuth } from '@/composables/useTRPC'

export const useUserStore = defineStore('user', () => {
  // 使用 tRPC composable
  const { user, isLoggedIn, login, logout } = useAuth()

  // 兼容现有代码的 getter
  const currentUser = computed(() => user.value)
  const isAuthenticated = computed(() => isLoggedIn.value)

  // 兼容现有代码的 action
  const loginUser = async (credentials: LoginForm) => {
    return await login(credentials)
  }

  const logoutUser = () => {
    logout()
  }

  return {
    // 状态
    currentUser,
    isAuthenticated,

    // 方法
    loginUser,
    logoutUser,
  }
})

// 保持向后兼容
export type LoginForm = {
  phone: string
  password: string
}
```

### 步骤8：环境变量配置

```typescript
// .env.development
VITE_API_URL=http://localhost:8787
VITE_TRPC_URL=http://localhost:8787/trpc

// .env.production
VITE_API_URL=https://api.yourdomain.com
VITE_TRPC_URL=https://api.yourdomain.com/trpc

// src/trpc/config.ts
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_TRPC_URL || 'http://localhost:8787/trpc',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
}
```

## 🔍 深入思考

### tRPC vs Axios 对比

| 特性     | Axios                     | tRPC                      |
| -------- | ------------------------- | ------------------------- |
| 类型安全 | 手动维护                  | 自动推断                  |
| API 调用 | `axios.get('/api/users')` | `trpc.users.list.query()` |
| 错误处理 | 手动 try/catch            | 统一错误处理              |
| 缓存     | 需要额外配置              | 内置查询缓存              |
| 批量请求 | 手动实现                  | 自动批处理                |
| 开发体验 | IDE 提示有限              | 完整智能提示              |

### 渐进式迁移策略

```typescript
// 阶段 1: 并存使用
import { http } from '@/request/http' // 保留 Axios
import { trpc } from '@/trpc/client' // 新增 tRPC

// 阶段 2: 逐步替换
// ❌ 旧方式
const users = await http.get('/api2/users')

// ✅ 新方式
const users = await trpc.users.list.query()

// 阶段 3: 完全迁移
// 移除所有 Axios 相关代码
```

### 性能优化考虑

```typescript
// 批量请求优化
const [user, articles, comments] = await Promise.all([
  trpc.users.me.query(),
  trpc.articles.list.query({ page: 1 }),
  trpc.comments.list.query({ articleId: '123' }),
])
// tRPC 自动将这些请求合并为一个 HTTP 请求

// 查询缓存优化
const articlesQuery = trpc.articles.list.useQuery(
  { page: 1 },
  {
    staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
    cacheTime: 10 * 60 * 1000, // 缓存保留10分钟
    refetchOnWindowFocus: false, // 窗口聚焦时不重新获取
  },
)
```

## ❓ 遇到的问题

### 问题 1：类型导入路径问题

**问题描述**：前端无法正确导入后端的 AppRouter 类型  
**解决方案**：

```typescript
// 方案 1: 相对路径导入 (开发阶段)
import type { AppRouter } from '../../../vue-blog-backend/src/trpc/router'

// 方案 2: 发布类型包 (生产阶段)
npm publish @vue-blog/api-types
npm install @vue-blog/api-types
import type { AppRouter } from '@vue-blog/api-types'
```

### 问题 2：开发环境 CORS 问题

**问题描述**：前端请求后端 tRPC 接口时 CORS 错误  
**解决方案**：

```typescript
// 后端添加 CORS 配置
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173'], // Vite 开发服务器
    credentials: true,
  }),
)
```

### 问题 3：认证状态同步

**问题描述**：页面刷新后认证状态丢失  
**解决方案**：

```typescript
// 应用启动时检查认证状态
const token = localStorage.getItem('auth_token')
if (token) {
  // 验证 token 有效性
  trpc.users.me.query().catch(() => {
    localStorage.removeItem('auth_token')
  })
}
```

## 🎥 参考资料

1. **[tRPC Vue 集成文档](https://trpc.io/docs/client/vue)**

   - 核心要点：Vue 3 + tRPC 的集成方式
   - 个人收获：理解了 Vue Query 与 tRPC 的协同工作

2. **[Tanstack Vue Query](https://tanstack.com/query/latest/docs/vue/overview)**
   - 核心要点：Vue 3 的数据获取和缓存库
   - 个人收获：掌握了现代化的数据管理方案

## 💡 个人心得

### 今天最大的收获

成功配置了 tRPC 前端客户端，体验到了端到端类型安全带来的开发效率提升。智能提示和类型检查大大减少了开发错误。

### tRPC 的开发体验

1. **智能提示**：IDE 能够准确提示 API 方法和参数类型
2. **类型安全**：编译时就能发现接口调用错误
3. **自动缓存**：配合 Vue Query 提供强大的缓存能力
4. **批量请求**：自动优化网络请求性能

### 与现有代码的兼容性

通过渐进式迁移策略，可以在不破坏现有功能的前提下，逐步享受 tRPC 的优势。

## 📋 行动清单

### 今日完成

- [x] 安装 tRPC 前端依赖
- [x] 配置 tRPC 客户端和 Vue Query
- [x] 创建 tRPC composables
- [x] 更新 Pinia store 集成
- [x] 解决开发环境配置问题

### 明日预习

- [ ] 了解 MSW 的基本配置
- [ ] 思考如何拦截 tRPC 请求
- [ ] 准备 Mock 数据的设计

## 🔗 有用链接

- [tRPC 客户端文档](https://trpc.io/docs/client/introduction)
- [Vue Query 文档](https://tanstack.com/query/latest/docs/vue/overview)
- [tRPC Vue 示例](https://github.com/trpc/trpc/tree/main/examples/next-prisma-starter)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

---

**📝 明日重点**：配置 MSW Mock 数据，实现前端开发时的 API Mock。
