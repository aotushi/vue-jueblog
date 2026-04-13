# vue-jueblog

> 仿掘金博客社区，Vue 3 全栈项目。

---

## 版本链接

| 版本 | 分支                | 在线演示 | 技术栈                       | 状态          |
| ---- | ------------------- | -------- | ---------------------------- | ------------- |
| V1   | [v1](../../tree/v1) | 已下线   | Vue 3 + Express + MongoDB    | ✅ 已归档     |
| V2   | [v2](../../tree/v2) | —        | Vue 3 + Hono + Cloudflare D1 | 🔄 本地测试中 |

> 当前所在分支：**v2**

---

## 功能特性

- 文章发布与阅读（Markdown 编辑器，支持 GFM / 代码高亮 / Mermaid / 图片缩放）
- 文章分类、标签筛选
- 嵌套评论（回复楼层）
- 点赞 / 收藏（文章 & 沸点）
- 关注 / 粉丝
- 消息通知（评论、点赞、关注）
- 沸点（短内容动态，按圈子分类）
- 用户主页 & 个人设置

---

## 技术架构（V2）

```
┌────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                       │
│                                                            │
│  ┌─────────────────────┐   ┌──────────────────────────┐   │
│  │   Static Assets     │   │   Hono API Server         │   │
│  │   (Vue 3 SPA dist)  │   │   /api2/*                 │   │
│  └─────────────────────┘   └──────────┬───────────────┘   │
│                                        │                   │
│                              ┌─────────▼──────────┐       │
│                              │  Cloudflare D1     │       │
│                              │  (SQLite)          │       │
│                              └────────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

| 层级        | 技术                                                           |
| ----------- | -------------------------------------------------------------- |
| 前端框架    | Vue 3 + TypeScript + Vite 6                                    |
| 状态管理    | Pinia + pinia-plugin-persistedstate                            |
| 路由        | Vue Router 4                                                   |
| UI 组件库   | Element Plus 2                                                 |
| HTTP 客户端 | Axios                                                          |
| Markdown    | ByteMD（GFM / Highlight / Mermaid / Medium-zoom 插件）         |
| 后端框架    | Hono 4（运行在 Cloudflare Workers）                            |
| 认证        | JWT（jose）                                                    |
| 数据库      | Cloudflare D1（SQLite，Wrangler 管理迁移）                     |
| 部署        | Cloudflare Workers + Static Assets（单 Worker 同时托管前后端） |

### 开发工具链

| 工具                     | 用途                              |
| ------------------------ | --------------------------------- |
| ESLint + Prettier        | 代码规范与格式化                  |
| Husky + lint-staged      | Git 提交前自动 lint/format        |
| commitlint + cz-git      | 规范化 Commit 信息                |
| vue-tsc                  | TypeScript 类型检查               |
| Wrangler 4               | Cloudflare Workers 本地开发与部署 |
| vite-plugin-vue-devtools | Vue DevTools 集成                 |

---

## 数据库设计

### 表结构

| 表名        | 说明                                                             |
| ----------- | ---------------------------------------------------------------- |
| `users`     | 用户（手机号登录，jue_power/good_num/read_num 统计）             |
| `articles`  | 文章（支持草稿 status=0 / 已发布 status=1）                      |
| `shortmsgs` | 沸点（短动态，按 `group_key` 圈子分类）                          |
| `comments`  | 评论（`type='article'` 或 `'shortmsg'`，支持回复嵌套）           |
| `praises`   | 点赞/收藏（`target_type`: 1=文章 2=沸点；`type`: 1=点赞 2=收藏） |
| `follows`   | 关注关系                                                         |
| `messages`  | 消息通知（评论/点赞/关注）                                       |

### 关键设计说明

- **数组字段**（`tags`, `images`）以 JSON 字符串存储，读取时 `JSON.parse`
- **点赞/收藏复用同一张表**，通过 `target_type + type` 区分场景
- **可选认证中间件**（`optionalAuth`）：列表/详情接口无需强制登录，但有 Token 时附加用户个性化数据（`is_praise`, `is_start`）
- **批量查询点赞状态**，避免列表接口 N+1 查询

---

## 项目结构

```
vue-jueblog/
├── src/                        # 前端源码
│   ├── pages/                  # 路由页面
│   │   ├── Home/               # 首页（文章列表）
│   │   ├── article/            # 文章详情 / 编写
│   │   ├── short-msg/          # 沸点列表 / 详情
│   │   ├── user/               # 用户主页
│   │   ├── message/            # 消息中心
│   │   └── setting/            # 个人设置
│   ├── stores/                 # Pinia Store
│   ├── components/             # 公共组件
│   ├── request/                # Axios 封装 & API 路径
│   ├── router/                 # 路由配置
│   └── composables/            # 组合式函数
├── worker/
│   ├── src/
│   │   ├── index.ts            # Worker 入口（Hono app）
│   │   ├── routes/             # API 路由（articles/users/comments/…）
│   │   └── middleware/         # 认证中间件（auth / optionalAuth）
│   └── migrations/             # D1 SQL 迁移文件
├── wrangler.toml               # Cloudflare Workers 配置
└── vite.config.ts              # Vite 配置（含 /api2 代理）
```

---

## API 路由

所有接口前缀 `/api2`，需要登录的接口请在请求头携带 `Authorization: Bearer <token>`。

| 方法   | 路径                       | 认证 | 说明                                        |
| ------ | -------------------------- | ---- | ------------------------------------------- |
| POST   | /api2/users/create         | —    | 注册                                        |
| POST   | /api2/users/login          | —    | 登录                                        |
| GET    | /api2/users/:id            | —    | 用户信息                                    |
| PUT    | /api2/users/:id            | ✓    | 更新用户资料                                |
| GET    | /api2/articles             | 可选 | 文章列表（含分类/标签筛选）                 |
| GET    | /api2/articles/category    | —    | 分类列表                                    |
| GET    | /api2/articles/:id         | 可选 | 文章详情（含 is_praise 状态）               |
| POST   | /api2/articles             | ✓    | 创建文章（草稿）                            |
| PUT    | /api2/articles/:id         | ✓    | 更新文章                                    |
| PUT    | /api2/articles/:id/publish | ✓    | 发布文章                                    |
| DELETE | /api2/articles/:id         | ✓    | 删除文章                                    |
| GET    | /api2/comments/list/:id    | —    | 评论列表（`?type=article\|shortmsg`）       |
| POST   | /api2/comments             | ✓    | 发表评论                                    |
| DELETE | /api2/comments/:id         | ✓    | 删除评论                                    |
| POST   | /api2/praises/toggle       | ✓    | 点赞/收藏切换（返回 `praised`/`cancelled`） |
| GET    | /api2/follows/toggle       | ✓    | 关注/取消关注                               |
| GET    | /api2/follows              | —    | 关注/粉丝列表                               |
| GET    | /api2/messages             | ✓    | 未读消息数                                  |
| GET    | /api2/messages/comments    | ✓    | 评论消息                                    |
| GET    | /api2/messages/praises     | ✓    | 点赞消息                                    |
| GET    | /api2/messages/follows     | ✓    | 关注消息                                    |
| GET    | /api2/stmsgs/groups        | —    | 沸点圈子分类                                |
| GET    | /api2/stmsgs               | 可选 | 沸点列表（含 is_praise 状态）               |
| POST   | /api2/stmsgs               | ✓    | 发布沸点                                    |
| DELETE | /api2/stmsgs/:id           | ✓    | 删除沸点                                    |

> **可选认证**：标注「可选」的接口匿名可访问，携带有效 Token 时会附加当前用户的点赞/收藏状态。

---

## 本地开发

### 环境要求

- Node.js 20+

### 启动步骤

```bash
# 1. 安装依赖
npm install

# 2. 初始化本地 D1 数据库
npm run db:migrate:local

# 3. 构建前端（首次或前端有改动时）
npm run build

# 4. 启动 Worker（含前端静态资源 + API）
npm run worker:dev
# 访问 http://localhost:8787
```

**前端热更新模式**（推荐开发时使用）：

```bash
# 终端 1：启动 Vite 开发服务器（热更新）
npm run dev           # http://localhost:5173

# 终端 2：启动 Worker API
npm run worker:dev    # http://localhost:8787
```

Vite 已配置 `/api2` 代理到 `:8787`，前端直接访问 `:5173` 即可。

---

## 部署到 Cloudflare

```bash
# 1. 创建远程 D1 数据库（首次）
npx wrangler d1 create vue-jueblog-db
# 将输出的 database_id 填入 wrangler.toml 的 [[d1_databases]] 中

# 2. 应用远程数据库迁移
npm run db:migrate:remote

# 3. 构建并部署
npm run build
npm run worker:deploy
```

---

## 版本演进

| 版本 | 分支 | 技术栈                       | 部署方式           | 说明                                       |
| ---- | ---- | ---------------------------- | ------------------ | ------------------------------------------ |
| V1   | v1   | Vue 3 + Express + MongoDB    | 服务器 + Nginx     | 初始版本，传统前后端分离                   |
| V2   | v2   | Vue 3 + Hono + Cloudflare D1 | Cloudflare Workers | 迁移至无服务器架构，前后端同一 Worker 部署 |

### V1 → V2 主要变化

- 后端从 Express 迁移到 **Hono**，运行在 Cloudflare Workers（无服务器，零冷启动）
- 数据库从 MongoDB 迁移到 **Cloudflare D1**（SQLite，边缘原生支持）
- 前后端合并为**单个 Worker** 部署，无需独立服务器

### MongoDB → D1 关键差异

| 特性                    | MongoDB（V1）            | D1 / SQLite（V2）              |
| ----------------------- | ------------------------ | ------------------------------ |
| 主键类型                | ObjectId（24位十六进制） | `INTEGER AUTOINCREMENT`        |
| 数组字段（tags/images） | 原生数组                 | JSON 字符串，读时 `JSON.parse` |
| 嵌套文档                | 子文档 / populate        | SQL JOIN + GROUP BY            |
| 复杂查询                | Mongoose aggregation     | 手写 SQL                       |
| 数据库连接              | TCP（不支持 Workers）    | HTTP API（Workers 原生支持）   |
| 字段名约定              | `_id`, `author` 对象     | `id` 整数，JOIN 后扁平字段     |
