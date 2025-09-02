# Day 6: MSW (Mock Service Worker) 学习

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 了解 [MSW](https://mswjs.io/) 的工作原理
- [ ] 学习如何用 MSW 替代 Strapi mock 数据
- [ ] 练习拦截网络请求并返回 mock 数据
- [ ] 了解 MSW 与 tRPC 的集成方式

## 📚 学习笔记

### MSW (Mock Service Worker) 概述

#### 什么是 MSW？

```
浏览器级别的 API Mock 工具
- 基于 Service Worker 技术
- 在网络层面拦截请求
- 不修改应用代码
- 支持 REST API 和 GraphQL
```

#### MSW vs 传统 Mock 方案

| 特性       | 传统 Mock (Strapi) | MSW            |
| ---------- | ------------------ | -------------- |
| 运行方式   | 独立服务器         | Service Worker |
| 性能开销   | 需要启动服务器     | 浏览器内拦截   |
| 网络请求   | 真实网络请求       | 拦截后模拟     |
| 开发体验   | 需要额外配置       | 零配置启动     |
| 部署复杂度 | 需要部署服务       | 纯前端方案     |

### MSW 工作原理

```
1. 注册 Service Worker
2. 拦截浏览器网络请求
3. 匹配预定义的请求处理器
4. 返回 Mock 数据响应
5. 应用收到响应（无感知）
```

#### 架构图

```
应用代码 → fetch/axios → Service Worker → MSW Handlers → Mock 响应
                                    ↓
                               (拦截请求)
                                    ↓
                              (返回 Mock 数据)
```

## 🛠️ 实践练习

### 步骤1：安装和配置 MSW

```bash
# 安装 MSW
npm install --save-dev msw

# 初始化 Service Worker
npx msw init public/ --save
```

### 步骤2：创建 Mock 处理器

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // 用户登录
  http.post('/api/users/login', async ({ request }) => {
    const { phone, password } = await request.json()

    // 模拟验证逻辑
    if (phone === '13888888888' && password === '123456') {
      return HttpResponse.json({
        code: 200,
        message: '登录成功',
        data: {
          token: 'mock-jwt-token-123456',
          user: {
            id: '1',
            phone: '13888888888',
            username: '测试用户',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
          },
        },
      })
    }

    return HttpResponse.json(
      {
        code: 20001,
        message: '用户名或密码错误',
      },
      { status: 400 },
    )
  }),

  // 用户信息查询
  http.get('/api/users/info/:id', ({ params }) => {
    const { id } = params

    return HttpResponse.json({
      code: 200,
      data: {
        id,
        username: `用户${id}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
        introduc: '这是一个测试用户的个人介绍',
        fans_num: Math.floor(Math.random() * 1000),
        follow_num: Math.floor(Math.random() * 500),
        jue_power: Math.floor(Math.random() * 10000),
      },
    })
  }),

  // 文章列表
  http.get('/api/articles/lists', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const size = parseInt(url.searchParams.get('size') || '10')

    // 生成 Mock 文章数据
    const articles = Array.from({ length: size }, (_, index) => ({
      id: `${page}-${index + 1}`,
      title: `Mock 文章标题 ${page}-${index + 1}`,
      summary: '这是一篇模拟的文章摘要，用于测试前端显示效果...',
      author: {
        id: '1',
        username: '测试作者',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=author',
      },
      created_at: new Date().toISOString(),
      like_count: Math.floor(Math.random() * 100),
      comment_count: Math.floor(Math.random() * 50),
      view_count: Math.floor(Math.random() * 1000),
    }))

    return HttpResponse.json({
      code: 200,
      data: {
        articles,
        pagination: {
          page,
          size,
          total: 100,
          totalPages: 10,
        },
      },
    })
  }),
]
```

### 步骤3：配置浏览器环境

```typescript
// mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

### 步骤4：在应用中启用 MSW

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'

async function enableMocking() {
  if (import.meta.env.MODE !== 'development') {
    return
  }

  const { worker } = await import('../mocks/browser')

  // 启动 Service Worker
  return worker.start({
    onUnhandledRequest: 'warn', // 对未处理的请求发出警告
  })
}

enableMocking().then(() => {
  createApp(App).mount('#app')
})
```

## 🔍 深入思考

### MSW 与 tRPC 的集成策略

由于 tRPC 通常使用自定义协议（如 `/trpc/users.login`），需要特殊处理：

```typescript
// MSW 处理 tRPC 请求
http.post('/trpc/*', async ({ request }) => {
  const url = new URL(request.url)
  const pathname = url.pathname

  // 解析 tRPC 路由
  const [, , procedure] = pathname.split('/')

  switch (procedure) {
    case 'users.login':
      const input = await request.json()
      return HttpResponse.json({
        result: {
          data: {
            token: 'mock-token',
            user: { id: '1', username: 'Test User' },
          },
        },
      })

    case 'articles.list':
      return HttpResponse.json({
        result: {
          data: mockArticles,
        },
      })

    default:
      return HttpResponse.json(
        { error: { message: 'Procedure not found' } },
        { status: 404 },
      )
  }
})
```

### 与当前项目的集成方案

```typescript
// 当前项目使用 axios 调用 API
// src/request/path/user.ts
const login = (data: LoginForm) => {
  return http.post('/api2/users/login', data) // 会被 MSW 拦截
}

// MSW 处理器匹配当前 API 路径
http.post('/api2/users/login', ({ request }) => {
  // 返回与真实 API 相同格式的数据
  return HttpResponse.json({
    code: 200,
    token: 'mock-token',
    result: {
      /* 用户数据 */
    },
  })
})
```

### 开发工作流程优化

```typescript
// 环境变量控制
// .env.development
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:3000

// .env.production
VITE_USE_MOCK=false
VITE_API_URL=https://your-api.com

// 条件启用 MSW
if (import.meta.env.VITE_USE_MOCK === 'true') {
  enableMocking()
}
```

## ❓ 遇到的问题

### 问题 1：Service Worker 注册失败

**问题描述**：在 HTTPS 环境下 Service Worker 无法注册  
**可能原因**：Service Worker 需要 HTTPS 或 localhost 环境  
**解决方案**：

```javascript
// 检查环境支持
if ('serviceWorker' in navigator) {
  worker.start()
} else {
  console.warn('Service Worker not supported')
}
```

### 问题 2：Mock 数据更新不及时

**问题描述**：修改 handlers 后需要刷新页面才生效  
**解决方案**：

```javascript
// 开发模式下启用热重载
if (import.meta.env.DEV) {
  worker.start({
    serviceWorker: {
      url: '/mockServiceWorker.js',
      options: {
        scope: '/',
        updateViaCache: 'none', // 禁用缓存
      },
    },
  })
}
```

## 🎥 参考资料

1. **[MSW 官方文档](https://mswjs.io/docs/)**

   - 核心要点：Service Worker 级别的 API Mock
   - 个人收获：理解了更现代化的 Mock 数据方案

2. **[Service Worker API 参考](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)**
   - 核心要点：浏览器 Service Worker 的工作原理
   - 个人收获：了解了底层技术原理

## 💡 个人心得

### 今天最大的收获

MSW 的设计理念很先进：在网络层面 Mock，而不是在代码层面替换。这样前端代码无需任何修改就能在 Mock 和真实 API 之间切换。

### 与传统 Mock 方案的对比

- **Strapi (当前)**：需要启动独立服务，配置复杂，有额外的服务器开销
- **MSW (升级后)**：纯前端方案，零配置，更接近真实网络请求

### 对开发效率的提升

1. **独立开发**：前端可以完全独立于后端进行开发
2. **快速迭代**：修改 Mock 数据无需重启服务
3. **真实模拟**：网络请求行为与生产环境一致

## 📋 行动清单

### 今日完成

- [ ] MSW 基础概念学习
- [ ] 创建测试用的 Mock 处理器
- [ ] 理解与 tRPC 的集成方案

### 明日预习

- [ ] 分析当前项目的 MongoDB 数据结构
- [ ] 设计 SQL 表结构映射方案
- [ ] 思考数据迁移的技术方案

## 🔗 有用链接

- [MSW 官方文档](https://mswjs.io/docs/)
- [MSW GitHub 仓库](https://github.com/mswjs/msw)
- [Service Worker MDN 文档](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MSW 示例项目](https://github.com/mswjs/examples)
- [MSW + Vite 集成指南](https://mswjs.io/docs/integrations/vite)

---

**📝 明日重点**：分析现有数据结构，设计从 MongoDB 到 D1 的迁移策略。
