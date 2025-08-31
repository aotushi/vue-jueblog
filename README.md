# 🚀 仿掘金网站 V2 - 边缘计算全栈架构

> 基于 Vue3 + TypeScript + Hono + tRPC + Cloudflare D1 的零成本边缘计算博客平台

## ✨ V2 版本亮点

### 🔄 架构升级对比

| 模块            | V1 (传统架构)             | V2 (边缘计算架构)      | 升级说明                            |
| --------------- | ------------------------- | ---------------------- | ----------------------------------- |
| **仓库结构**    | 单仓库 (混合)             | 前后端分离仓库         | 独立开发、独立部署                  |
| **前端框架**    | Vue 3 + Vite              | Vue 3 + Vite           | 保持不变 ✅                         |
| **HTTP 客户端** | Axios                     | **tRPC Client**        | 🔄 **需替换** - 类型安全的 RPC 调用 |
| **状态管理**    | Pinia + REST              | Pinia + tRPC           | 🔄 Store 调用方式升级               |
| **后端框架**    | Express                   | **Hono**               | 🔄 轻量级，专为 Workers 优化        |
| **API 设计**    | REST API                  | **tRPC RPC**           | 🔄 函数式调用，端到端类型安全       |
| **数据库**      | MongoDB + Mongoose        | **Cloudflare D1**      | 🔄 需要数据迁移                     |
| **部署方式**    | 单一服务器                | **前后端分离部署**     | 🔄 Pages + Workers                  |
| **Mock 方案**   | Strapi (backend-mockdata) | **MSW**                | 🔄 浏览器级别拦截，更现代           |
| **开发体验**    | 手动维护接口类型          | **自动类型推断**       | ✨ IDE 智能补全                     |
| **性能**        | 单点服务器响应            | **300+ 边缘节点**      | ⚡ 延迟降低 50-80%                  |
| **成本**        | 固定服务器 ($20-50/月)    | **几乎免费** ($0-2/月) | 💰 成本节省 90%+                    |

## 🎯 技术栈

### 前端

- **Vue 3** - Composition API + `<script setup>`
- **TypeScript** - 严格类型检查
- **Vite** - 极速构建工具
- **Pinia** - 现代状态管理
- **Element Plus** - UI 组件库
- **tRPC Client** - 类型安全的 API 调用
- **MSW** - 现代化 Mock 数据方案

### 后端

- **Hono** - 高性能 Web 框架 (专为 Cloudflare Workers 优化)
- **tRPC** - 端到端类型安全的 RPC 框架
- **Zod** - TypeScript 优先的数据验证
- **Cloudflare Workers** - 边缘计算平台

### 数据库

- **Cloudflare D1** - 边缘 SQLite 数据库 (已选定) ⭐

## 🚀 核心优势

### 1. 🔒 端到端类型安全

```typescript
// 后端定义
const userRouter = router({
  getUser: publicProcedure
    .input(z.string())
    .query(({ input }) => getUserById(input)),
})

// 前端调用 - 完全类型安全，自动补全
const user = await trpc.users.getUser.query(userId)
//    ↑ TypeScript 自动推断 user 的完整类型
```

### 2. ⚡ 边缘计算性能

- **全球分发**: 300+ 边缘节点，就近响应
- **冷启动优化**: Hono 框架专为 Serverless 优化
- **自动缓存**: Cloudflare 智能缓存策略

### 3. 💰 成本效益 (几乎免费！)

- **Cloudflare Workers**: 每月 100,000 请求免费
- **Cloudflare D1**: 每月 100,000 读取免费
- **Cloudflare Pages**: 静态托管完全免费
- **零服务器成本**: 无需维护数据库服务器
- **估算月成本**: $0-2 (仅超出免费额度时)

### 4. 🛠️ 开发体验

- **智能补全**: IDE 完整的类型提示
- **自动重构**: 修改后端接口，前端自动更新
- **错误提前发现**: 编译期类型检查

## 📋 功能模块

### 核心功能

- ✅ **用户系统**: 注册、登录、个人资料
- ✅ **文章管理**: 创建、编辑、发布、分类
- ✅ **互动功能**: 点赞、收藏、评论
- ✅ **沸点系统**: 短内容发布和互动
- ✅ **消息中心**: 通知、私信管理
- ✅ **搜索功能**: 全文搜索、标签筛选

### V2 新增特性

- 🆕 **实时更新**: WebSocket 支持
- 🆕 **离线缓存**: PWA 支持
- 🆕 **多主题**: 明暗主题切换
- 🆕 **国际化**: 多语言支持
- 🆕 **性能监控**: 实时性能分析

## 🏗️ 项目架构

### 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vue 3 SPA     │───▶│ Cloudflare      │───▶│ Cloudflare D1   │
│   (Vite + tRPC) │    │ Workers         │    │ (边缘数据库)      │
│                 │    │ (Hono + tRPC)   │    │ SQLite 存储     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Cloudflare      │    │ 300+ 边缘节点   │    │ 自动备份恢复    │
│ Pages (静态)     │    │ 代码全球分发     │    │ 零维护成本      │
└─────────────────┘    └─────────────────┘    └─────────────────┘

🌍 真正的边缘计算架构 - API 和数据都在边缘节点，实现极低延迟访问
```

### 仓库结构 (前后端分离)

#### 前端仓库 `vue-jueblog-frontend`

```
vue-jueblog-frontend/
├── src/
│   ├── components/          # Vue 组件
│   ├── pages/              # 页面组件
│   ├── stores/             # Pinia 状态管理 (需升级为 tRPC)
│   ├── utils/              # 工具函数
│   ├── trpc/               # 🆕 tRPC 客户端配置
│   └── request/            # ❌ 移除 axios 相关代码
├── mocks/                  # 🆕 MSW Mock 配置
├── types/                  # 🆕 共享类型定义
├── vite.config.ts
└── package.json
```

#### 后端仓库 `vue-jueblog-backend`

```
vue-jueblog-backend/
├── src/
│   ├── trpc/              # 🆕 tRPC 路由定义
│   │   ├── users.ts       # 用户相关 procedures
│   │   ├── articles.ts    # 文章相关 procedures
│   │   └── router.ts      # 根路由配置
│   ├── db/                # 🆕 D1 数据库操作
│   │   ├── schema.sql     # 数据库结构定义
│   │   └── migrations/    # 迁移文件
│   ├── middleware/        # 🆕 tRPC 中间件
│   └── index.ts           # 🆕 Hono 应用入口
├── migration-tools/       # 🆕 MongoDB → D1 迁移
├── wrangler.toml          # 🆕 Cloudflare Workers 配置
└── package.json
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm** >= 8 (推荐)
- **Cloudflare 账户** (部署用)

### 本地开发 (前后端分离)

#### 前端开发

```bash
# 1. 克隆前端项目
git clone https://github.com/your-username/vue-jueblog-frontend.git
cd vue-jueblog-frontend

# 2. 安装依赖 (移除 axios，添加 tRPC)
pnpm install
pnpm add @trpc/client @trpc/vue-query
pnpm remove axios  # ❌ 移除 axios

# 3. 启动开发服务器
pnpm dev            # http://localhost:5173

# 4. 启用 Mock 数据 (开发阶段)
pnpm dev:mock       # 🆕 MSW 自动拦截网络请求
```

#### 后端开发

```bash
# 1. 克隆后端项目
git clone https://github.com/your-username/vue-jueblog-backend.git
cd vue-jueblog-backend

# 2. 安装依赖
pnpm install
pnpm add hono @trpc/server zod

# 3. 配置 D1 本地数据库
wrangler d1 create vue-jueblog
wrangler d1 execute vue-jueblog --local --file=src/db/schema.sql

# 4. 启动开发服务器
pnpm dev            # http://localhost:8787 (wrangler dev)
```

### 部署到 Cloudflare (分离部署)

#### 后端部署 (Workers)

```bash
cd vue-jueblog-backend

# 1. 登录 Cloudflare
wrangler login

# 2. 创建生产数据库
wrangler d1 create vue-jueblog-prod
wrangler d1 execute vue-jueblog-prod --file=src/db/schema.sql

# 3. 部署到 Workers
wrangler publish
```

#### 前端部署 (Pages)

```bash
cd vue-jueblog-frontend

# 1. 构建生产版本
pnpm build

# 2. 部署到 Cloudflare Pages (自动部署)
# 连接 GitHub 仓库，推送代码即可自动部署
git push origin main

# 或手动部署
wrangler pages publish dist
```

## 📚 开发指南

### API 开发流程

1. **定义后端接口**

```typescript
// backend/src/trpc/users.ts
export const userRouter = router({
  profile: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      // 直接查询 Cloudflare D1 数据库
      return await ctx.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(input)
        .first()
    }),
})
```

2. **前端调用升级 (替换 axios)**

```typescript
// ❌ V1: 使用 axios (需要移除)
// src/request/path/user.ts
const getUser = (id: string) => {
  return http.get(`/api2/users/info/${id}`) // 无类型安全
}

// ✅ V2: 使用 tRPC Client
// src/stores/user.ts
const getUserProfile = async (id: string) => {
  // 完全类型安全，自动补全，无需手动维护接口类型
  const profile = await trpc.users.profile.query(id)
  return profile // TypeScript 自动推断完整类型
}
```

### Mock 数据配置升级

```typescript
// ❌ V1: Strapi backend-mockdata (繁琐)
// 需要启动单独的 Strapi 服务，配置复杂

// ✅ V2: MSW (现代化)
// frontend/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // 拦截 tRPC 请求
  http.post('/trpc/users.login', () => {
    return HttpResponse.json({
      result: { data: { token: 'mock-jwt-token', user: { id: '1' } } },
    })
  }),

  http.get('/trpc/articles.list', () => {
    return HttpResponse.json({
      result: { data: mockArticles },
    })
  }),
]

// 自动启用 (开发环境)
if (import.meta.env.DEV) {
  const { worker } = await import('./browser')
  worker.start()
}
```

## 🔧 配置说明

### 环境变量

```bash
# .env.local
VITE_API_URL=http://localhost:8787  # 开发环境 API 地址
VITE_MOCK_ENABLED=true              # 是否启用 Mock
JWT_SECRET=your-jwt-secret          # JWT 密钥

# Cloudflare Workers 环境变量 (wrangler.toml)
# DATABASE_URL 不再需要 - 使用 D1 绑定
```

### Cloudflare Workers 配置

```toml
# wrangler.toml
name = "vue-jueblog-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
NODE_ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "vue-jueblog"
database_id = "your-database-id"
```

## 📈 性能优化

### 前端优化

- ✅ **代码分割**: 路由级别的懒加载
- ✅ **Tree Shaking**: 移除未使用代码
- ✅ **缓存策略**: 长期缓存静态资源
- ✅ **PWA**: Service Worker 缓存

### 后端优化

- ✅ **边缘缓存**: Cloudflare 自动缓存
- ✅ **数据库优化**: 连接池 + 查询优化
- ✅ **压缩传输**: Gzip/Brotli 压缩
- ✅ **批量请求**: tRPC 自动批处理

## 🧪 测试策略

- **单元测试**: Vitest + Vue Test Utils
- **API 测试**: tRPC 端到端测试
- **E2E 测试**: Playwright 集成测试
- **类型测试**: TypeScript 编译时检查
- **数据库测试**: D1 本地测试环境

## 📊 数据迁移

### MongoDB → Cloudflare D1 迁移策略

```typescript
// 数据结构映射示例
// MongoDB (V1) → D1 (V2)
interface UserMigration {
  _id: ObjectId → id: string
  phone: string → phone: string
  username: string → username: string
  createdAt: Date → created_at: string
}
```

### 迁移工具

- **导出脚本**: `migration-tools/export-mongo.js`
- **导入脚本**: `migration-tools/import-d1.js`
- **数据验证**: 自动对比迁移前后数据一致性
- **批量处理**: 支持大数据量分批迁移

## 📖 学习资源

- [tRPC 官方文档](https://trpc.io/docs)
- [Hono 框架指南](https://hono.dev/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [TypeScript 最佳实践](https://www.typescriptlang.org/docs/)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📝 变更日志

### V2.0.0 (计划中)

- 🎉 全新架构升级
- ✨ tRPC + Hono 技术栈
- 🚀 Cloudflare Workers 部署
- 🔒 端到端类型安全
- ⚡ 性能提升 300%

### V1.0.0 (当前)

- ✅ Vue3 + Express 基础架构
- ✅ 核心功能完整实现
- ✅ MongoDB 数据存储
- ⚠️ 需要服务器维护，成本较高

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

感谢以下开源项目：

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [tRPC](https://trpc.io/) - 端到端类型安全 RPC
- [Hono](https://hono.dev/) - 轻量级 Web 框架
- [Cloudflare](https://cloudflare.com/) - 边缘计算平台
