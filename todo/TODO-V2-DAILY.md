# 🚀 V2 架构升级 - 每日1小时计划

> 将 Vue3 + Express + MongoDB 架构升级为 Vue3 + Hono + tRPC + Cloudflare D1  
> **目标**：每天投入1小时，循序渐进完成现代化边缘计算架构升级

## 📅 总体进度

- **预计总时长**：30-35 小时
- **预计完成时间**：5-6 周
- **当前状态**：📋 计划阶段

---

## 🎯 Week 1: 学习准备阶段 (7小时)

### Day 1: tRPC 基础概念学习 (1h)

- [ ] 阅读 [tRPC 官方文档](https://trpc.io/docs/quickstart) 基础部分
- [ ] 理解 RPC vs REST 的区别和优势
- [ ] 学习 tRPC 的核心概念：Router、Procedure、Client
- [ ] 观看一个 tRPC 快速入门视频教程

### Day 2: Hono 框架入门 (1h)

- [ ] 阅读 [Hono 官方文档](https://hono.dev/) 基础部分
- [ ] 了解 Hono 相比 Express 的优势
- [ ] 学习 Hono 的中间件系统
- [ ] 创建一个简单的 Hello World Hono 应用

### Day 3: Cloudflare Workers 环境准备 (1h)

- [ ] 注册/登录 Cloudflare 账户
- [ ] 安装 Wrangler CLI：`npm install -g wrangler`
- [ ] 学习 Wrangler 基本命令：`wrangler login`、`wrangler dev`
- [ ] 创建第一个 "Hello World" Worker

### Day 4: Cloudflare D1 数据库学习 (1h)

- [ ] 了解 [Cloudflare D1](https://developers.cloudflare.com/d1/) 基础概念
- [ ] 学习 D1 vs MongoDB 的区别（SQL vs NoSQL）
- [ ] 创建测试 D1 数据库：`wrangler d1 create test-db`
- [ ] 学习基本 SQL 语法（用于后续数据迁移）

### Day 5: TypeScript 和 Zod 验证 (1h)

- [ ] 复习 TypeScript 高级类型（联合类型、泛型等）
- [ ] 学习 [Zod](https://zod.dev/) 数据验证库
- [ ] 练习创建 Zod schema 验证用户输入
- [ ] 了解 Zod 与 TypeScript 的类型推断

### Day 6: MSW (Mock Service Worker) 学习 (1h)

- [ ] 了解 [MSW](https://mswjs.io/) 的工作原理
- [ ] 学习如何用 MSW 替代 Strapi mock 数据
- [ ] 练习拦截网络请求并返回 mock 数据
- [ ] 了解 MSW 与 tRPC 的集成方式

### Day 7: 数据迁移策略规划 (1h)

- [ ] 分析现有 MongoDB 数据结构
- [ ] 设计 SQL 表结构映射方案
- [ ] 规划数据迁移脚本架构
- [ ] 制定数据一致性验证方案

---

## 🏗️ Week 2: 项目结构搭建 (7小时)

### Day 8: 创建后端项目结构 (1h)

- [ ] 在根目录创建 `vue-blog-backend/` 文件夹
- [ ] 初始化后端 package.json
- [ ] 安装核心依赖：`hono`, `@trpc/server`, `zod`
- [ ] 创建基础目录结构：`src/`, `src/trpc/`, `src/db/`

### Day 9: 配置 Cloudflare Workers 环境 (1h)

- [ ] 创建 `wrangler.toml` 配置文件
- [ ] 配置本地开发环境变量
- [ ] 创建 D1 数据库绑定配置
- [ ] 测试 `wrangler dev` 本地开发服务器

### Day 10: 搭建 tRPC 基础架构 (1h)

- [ ] 创建 tRPC 根 router 配置
- [ ] 设置 tRPC 上下文 (Context)
- [ ] 配置 JWT 中间件（迁移现有认证逻辑）
- [ ] 创建第一个测试 procedure

### Day 11: 设计 D1 数据库表结构 (1h)

- [ ] 分析现有 MongoDB 集合结构
- [ ] 设计 users 表 SQL schema
- [ ] 设计 articles、comments 等表结构
- [ ] 创建 `schema.sql` 数据库初始化文件

### Day 12: 用户认证模块重构 (1h)

- [ ] 创建 `src/trpc/users.ts` 用户相关 procedures
- [ ] 实现用户注册 procedure
- [ ] 实现用户登录 procedure
- [ ] 测试用户认证流程

### Day 13: 前端 tRPC 客户端配置 (1h)

- [ ] 安装前端 tRPC 依赖：`@trpc/client`, `@trpc/vue-query`
- [ ] 创建 `src/trpc/` 前端配置目录
- [ ] 配置 tRPC 客户端连接
- [ ] 移除部分 axios 依赖（保留用于渐进式迁移）

### Day 14: MSW Mock 数据配置 (1h)

- [ ] 安装 MSW：`npm install --save-dev msw`
- [ ] 创建 `mocks/` 目录和基础配置
- [ ] 配置拦截 tRPC 请求的 handlers
- [ ] 测试前端开发环境 mock 数据

---

## 🔄 Week 3: 核心功能迁移 (7小时)

### Day 15: 文章管理模块重构 (1h)

- [ ] 创建 articles 表和相关 procedures
- [ ] 实现文章列表查询 procedure
- [ ] 实现文章详情查询 procedure
- [ ] 更新前端文章相关的 store 调用

### Day 16: 评论系统模块重构 (1h)

- [ ] 创建 comments 表结构
- [ ] 实现评论 CRUD procedures
- [ ] 处理评论的层级关系（回复功能）
- [ ] 测试评论功能

### Day 17: 点赞收藏模块重构 (1h)

- [ ] 创建 praises 表结构
- [ ] 实现点赞/取消点赞 procedure
- [ ] 实现收藏功能 procedure
- [ ] 优化点赞状态查询性能

### Day 18: 关注系统模块重构 (1h)

- [ ] 创建 follows 表结构
- [ ] 实现关注/取消关注 procedure
- [ ] 实现关注者/粉丝列表查询
- [ ] 测试关注系统逻辑

### Day 19: 沸点功能模块重构 (1h)

- [ ] 创建 shortmsg 表结构
- [ ] 实现沸点发布 procedure
- [ ] 实现沸点列表查询
- [ ] 沸点互动功能（点赞、评论）

### Day 20: 消息通知模块重构 (1h)

- [ ] 创建 messages 表结构
- [ ] 实现消息推送 procedure
- [ ] 实现消息列表查询
- [ ] 处理消息已读状态

### Day 21: 前端状态管理升级 (1h)

- [ ] 更新所有 Pinia store 使用 tRPC 调用
- [ ] 移除所有 axios 相关代码
- [ ] 测试前端各模块功能
- [ ] 修复类型错误和调用问题

---

## 🚀 Week 4: 数据迁移和优化 (7小时)

### Day 22: 数据导出脚本开发 (1h)

- [ ] 创建 `migration-tools/export-mongo.js`
- [ ] 实现 MongoDB 数据导出功能
- [ ] 处理数据格式转换（ObjectId → string）
- [ ] 生成 JSON 格式的中间数据文件

### Day 23: 数据导入脚本开发 (1h)

- [ ] 创建 `migration-tools/import-d1.js`
- [ ] 实现 D1 数据库批量导入功能
- [ ] 处理数据类型转换和字段映射
- [ ] 实现分批导入（处理大数据量）

### Day 24: 数据迁移执行和验证 (1h)

- [ ] 执行完整的数据迁移流程
- [ ] 验证数据一致性和完整性
- [ ] 处理迁移过程中的错误和异常
- [ ] 记录迁移日志和统计信息

### Day 25: 性能优化和缓存策略 (1h)

- [ ] 优化 SQL 查询性能
- [ ] 实现合理的数据库索引
- [ ] 配置 Cloudflare Workers 缓存策略
- [ ] 优化前端请求批处理

### Day 26: 错误处理和日志系统 (1h)

- [ ] 完善 tRPC 错误处理机制
- [ ] 实现统一的错误码和错误消息
- [ ] 配置前端错误捕获和用户友好提示
- [ ] 设置后端日志记录系统

### Day 27: 安全性加固 (1h)

- [ ] 审核和加强 JWT 认证机制
- [ ] 实现请求频率限制
- [ ] 配置 CORS 安全策略
- [ ] 验证用户输入和 SQL 注入防护

### Day 28: 单元测试编写 (1h)

- [ ] 为关键 procedures 编写单元测试
- [ ] 测试数据验证逻辑
- [ ] 测试认证中间件
- [ ] 配置测试数据库环境

---

## 🎯 Week 5: 部署和上线 (7小时)

### Day 29: 生产环境配置 (1h)

- [ ] 配置生产环境的 wrangler.toml
- [ ] 创建生产环境 D1 数据库
- [ ] 配置环境变量和密钥管理
- [ ] 设置域名和 SSL 证书

### Day 30: 前端生产构建优化 (1h)

- [ ] 优化 Vite 生产构建配置
- [ ] 配置代码分割和懒加载
- [ ] 优化静态资源缓存策略
- [ ] 测试生产环境构建结果

### Day 31: 后端部署到 Workers (1h)

- [ ] 执行 `wrangler publish` 部署后端
- [ ] 测试 Workers API 响应性能
- [ ] 配置自定义域名绑定
- [ ] 设置监控和告警

### Day 32: 前端部署到 Pages (1h)

- [ ] 配置 Cloudflare Pages 自动部署
- [ ] 连接 GitHub 仓库自动构建
- [ ] 设置自定义域名和 DNS
- [ ] 测试前后端完整交互

### Day 33: 全面功能测试 (1h)

- [ ] 测试用户注册、登录流程
- [ ] 测试文章发布、编辑、删除
- [ ] 测试评论、点赞、关注功能
- [ ] 测试沸点和消息功能

### Day 34: 性能监控和优化 (1h)

- [ ] 配置 Cloudflare Analytics
- [ ] 监控 API 响应时间和错误率
- [ ] 优化慢查询和性能瓶颈
- [ ] 设置用户体验监控

### Day 35: 文档更新和项目收尾 (1h)

- [ ] 更新 README.md 部署文档
- [ ] 编写 V2 架构迁移总结
- [ ] 记录已知问题和后续优化计划
- [ ] 庆祝 V2 版本成功上线！🎉

---

## 📊 进度追踪

### 完成统计

- ✅ 已完成：0/35 天
- 🔄 进行中：0/35 天
- ⏰ 待开始：35/35 天

### 里程碑

- [ ] **Week 1 完成**：掌握核心技术栈
- [ ] **Week 2 完成**：项目架构搭建完毕
- [ ] **Week 3 完成**：核心功能迁移完成
- [ ] **Week 4 完成**：数据迁移和性能优化
- [ ] **Week 5 完成**：生产环境部署上线

---

## 📝 使用说明

1. **每日执行**：选择一天的任务，专注1小时完成
2. **灵活调整**：根据实际进度调整任务优先级
3. **记录问题**：遇到困难时记录问题和解决方案
4. **阶段性总结**：每周结束后回顾进度和经验

---

## 🔗 相关资源

- [tRPC 官方文档](https://trpc.io/docs)
- [Hono 框架文档](https://hono.dev/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [原 V2 详细计划](./todo/v2.md)

---

**🎯 目标**：通过35个小时的投入，完成从传统服务器架构到现代边缘计算架构的完全转型！
