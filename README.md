# vue-jueblog

仿掘金博客社区，Vue 3 全栈项目。

## 技术架构（v3）

| 层级   | 技术                                             |
| ------ | ------------------------------------------------ |
| 前端   | Vue 3 + TypeScript + Vite + Pinia + Element Plus |
| 后端   | Hono（Cloudflare Workers）                       |
| 数据库 | Cloudflare D1（SQLite）                          |
| 部署   | Cloudflare Workers Static Assets                 |

## 版本历史

- **v1/v2**：Express + MongoDB + Docker + Nginx（服务器部署）
- **v3**：全部迁移到 Cloudflare Workers（前后端一体化）

## 本地开发

### 环境要求

- Node.js 20+
- 依赖已包含 Wrangler CLI

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

> **前端热更新开发**：同时运行 `npm run dev`（Vite :5173）和 `npm run worker:dev`（API :8787），Vite 已配置代理。

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

## API 路由

所有接口前缀 `/api2`，需要登录的接口请在请求头携带 `Authorization: Bearer <token>`。

| 方法   | 路径                       | 认证 | 说明          |
| ------ | -------------------------- | ---- | ------------- |
| POST   | /api2/users/create         | —    | 注册          |
| POST   | /api2/users/login          | —    | 登录          |
| GET    | /api2/users/:id            | —    | 用户信息      |
| PUT    | /api2/users/:id            | ✓    | 更新用户      |
| GET    | /api2/articles             | —    | 文章列表      |
| GET    | /api2/articles/category    | —    | 分类列表      |
| GET    | /api2/articles/:id         | —    | 文章详情      |
| POST   | /api2/articles             | ✓    | 创建文章      |
| PUT    | /api2/articles/:id         | ✓    | 更新文章      |
| PUT    | /api2/articles/:id/publish | ✓    | 发布文章      |
| DELETE | /api2/articles/:id         | ✓    | 删除文章      |
| GET    | /api2/comments             | —    | 评论列表      |
| POST   | /api2/comments             | ✓    | 发表评论      |
| DELETE | /api2/comments/:id         | ✓    | 删除评论      |
| POST   | /api2/praises/toggle       | ✓    | 点赞/收藏切换 |
| GET    | /api2/praises/check        | ✓    | 检查点赞状态  |
| POST   | /api2/follows/toggle       | ✓    | 关注/取消     |
| GET    | /api2/follows/check        | ✓    | 检查关注状态  |
| GET    | /api2/follows              | —    | 关注/粉丝列表 |
| GET    | /api2/messages             | ✓    | 未读消息数    |
| GET    | /api2/messages/comments    | ✓    | 评论消息      |
| GET    | /api2/messages/praises     | ✓    | 点赞消息      |
| GET    | /api2/messages/follows     | ✓    | 关注消息      |
| GET    | /api2/stmsgs/groups        | —    | 圈子分类      |
| GET    | /api2/stmsgs               | —    | 沸点列表      |
| POST   | /api2/stmsgs               | ✓    | 发布沸点      |
| DELETE | /api2/stmsgs/:id           | ✓    | 删除沸点      |

## MongoDB vs D1 关键差异

| 特性                    | MongoDB（旧）            | D1 / SQLite（新）              |
| ----------------------- | ------------------------ | ------------------------------ |
| 数组字段（tags/images） | 原生数组                 | JSON 字符串，读时 `JSON.parse` |
| ID 类型                 | ObjectId（24位十六进制） | `INTEGER AUTOINCREMENT`        |
| 复杂查询                | Mongoose aggregation     | SQL JOIN + GROUP BY            |
| 连接方式                | TCP（不支持 Workers）    | HTTP（Workers 原生支持）       |
