# vue-jueblog

> 仿掘金博客社区的 Vue 3 全栈项目，通过不同分支保留三种后端与部署方案。

## 在线体验

- **V3（当前实现）**：[https://juejin-blog.9shi.cc/](https://juejin-blog.9shi.cc/)

> `main` 是项目说明与版本导航入口。生产站点对应 `v3` 分支，自动部署服务应监听 `v3`。

## 版本导航

| 版本 | 分支                | 核心方案                                 | 定位              |
| ---- | ------------------- | ---------------------------------------- | ----------------- |
| V1   | [v1](../../tree/v1) | Vue 3 + Express + MongoDB                | 传统服务器版本    |
| V2   | [v2](../../tree/v2) | Vue 3 + Hono + tRPC + Cloudflare         | 类型安全 RPC 方案 |
| V3   | [v3](../../tree/v3) | Vue 3 + Hono REST + D1 原生 SQL + Worker | 当前部署方案      |

V2 与 V3 是两种 Cloudflare 实现路线，不是简单的前后版本替换：

- **V2** 以 tRPC 为核心，通过共享 Router 类型提供端到端类型安全。
- **V3** 保留 REST `/api2/*` 接口，由 Hono 路由通过 D1 binding 直接执行原生 SQL。

历史上曾把 `v3` 的实现合并进 `v2`，因此 Git 提交关系不能单独代表版本含义。版本概念以本 README 和各分支 README 为准。

## 核心功能

- 文章发布、编辑、阅读、分类和标签筛选
- Markdown、GFM、代码高亮、Mermaid 和图片缩放
- 文章与沸点的评论、点赞和收藏
- 用户注册、登录、主页、设置、关注和粉丝
- 评论、点赞和关注消息通知
- 沸点短内容和圈子分类

## 三种方案对比

| 对比项   | V1                      | V2                        | V3                                   |
| -------- | ----------------------- | ------------------------- | ------------------------------------ |
| API 风格 | Express REST            | tRPC procedure            | Hono REST `/api2/*`                  |
| 数据访问 | Mongoose                | tRPC 服务层封装           | Worker 使用 D1 binding 执行原生 SQL  |
| 数据库   | MongoDB                 | D1 / Supabase（方案阶段） | Cloudflare D1（SQLite）              |
| 部署     | 服务器 + Docker + Nginx | Cloudflare Workers        | 单个 Cloudflare Worker               |
| 前端调用 | Axios                   | tRPC Client               | Axios                                |
| 主要价值 | 传统架构，资料完整      | 端到端类型安全            | 架构直接、依赖少、延续现有 REST 调用 |
| 状态     | 已归档                  | 方案实验                  | 当前实现与部署                       |

### V1：Express + MongoDB

```text
Vue SPA  →  Express REST API  →  MongoDB
```

V1 是最初版本，采用传统前后端分离、独立服务器和 MongoDB。完整说明见 [`v1` 分支](../../tree/v1)。

### V2：Hono + tRPC

```text
Vue + tRPC Client  →  Hono + tRPC Worker  →  Database
```

V2 探索端到端类型安全：前端通过 tRPC Client 调用 procedure，前后端共享类型，并由服务层封装数据库访问；方案资料同时比较了 D1 与 Supabase。完整资料见 [`v2` 分支](../../tree/v2)。

### V3：Hono REST + D1 原生 SQL

```text
Vue SPA / Axios  →  Hono REST API  →  D1 binding / raw SQL
       └──────── Static Assets + API in one Worker ────────┘
```

V3 是当前实现：Vue 静态资源与 Hono API 由同一个 Worker 提供，路由直接使用 D1 binding 执行 SQL。

“直接操作数据库”指 **Worker 直接访问 D1**。浏览器仍然只能调用 `/api2/*`，不会绕过后端连接数据库。

## V2 与 V3 的取舍

| 对比项   | V2：tRPC 方案                      | V3：D1 原生方案                     |
| -------- | ---------------------------------- | ----------------------------------- |
| 类型体验 | 前后端共享类型，调用错误可提前发现 | 请求与响应类型需要分别维护          |
| 迁移成本 | 需要把 Axios/REST 调用迁移到 tRPC  | 可以延续现有 Axios 和 REST 路径     |
| 依赖关系 | 客户端与服务端 Router 类型耦合     | 前后端通过 HTTP 接口契约解耦        |
| 数据访问 | 通过 tRPC procedure 和服务层封装   | Hono 路由直接使用 D1 binding 和 SQL |
| 适合场景 | 重视端到端类型安全和统一调用体验   | 重视简单部署、较少依赖和渐进迁移    |

## 名称说明

- 本项目资料中的 RPC 方案是 **tRPC**，不是 gRPC。
- `.wrangler/state/v3/` 中的 `v3` 是 Wrangler 的本地状态目录版本，与 Git 的 `v3` 分支无关。
- `main` 用于项目说明；具体开发和运行方式以对应版本分支的 README 为准。

## 快速开始 V3

```bash
git clone https://github.com/aotushi/vue-jueblog.git
cd vue-jueblog
git checkout v3
npm install
npm run db:migrate:local
npm run build
npm run worker:dev
```

访问 `http://localhost:8787`。更完整的本地开发、数据库和部署说明见 [`v3` 分支 README](../../tree/v3)。

## 技术栈

- Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router
- ByteMD、Showdown、Axios
- Hono、Cloudflare Workers、Cloudflare D1、Wrangler
- JWT（jose）、ESLint、Prettier、Husky

## 许可证

[MIT License](LICENSE)
