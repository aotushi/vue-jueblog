# Day 8: 创建后端项目结构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 在根目录创建 `vue-blog-backend/` 文件夹
- [ ] 初始化后端 package.json
- [ ] 安装核心依赖：`hono`, `@trpc/server`, `zod`
- [ ] 创建基础目录结构：`src/`, `src/trpc/`, `src/db/`

## 📚 学习笔记

### 项目目录结构设计

```
vue-jueblog/
├── src/                    # 前端源码 (已存在)
├── vue-blog-backend/       # 🆕 后端项目文件夹
│   ├── src/
│   │   ├── index.ts        # Hono 应用入口
│   │   ├── trpc/           # tRPC 路由定义
│   │   │   ├── router.ts   # 根路由
│   │   │   ├── context.ts  # tRPC 上下文
│   │   │   ├── users.ts    # 用户相关 procedures
│   │   │   ├── articles.ts # 文章相关 procedures
│   │   │   └── comments.ts # 评论相关 procedures
│   │   ├── db/             # 数据库相关
│   │   │   ├── schema.sql  # 数据库结构
│   │   │   └── seed.sql    # 测试数据
│   │   ├── middleware/     # 中间件
│   │   │   └── auth.ts     # JWT 认证中间件
│   │   └── utils/          # 工具函数
│   │       ├── jwt.ts      # JWT 工具
│   │       └── crypto.ts   # 加密工具
│   ├── package.json        # 后端依赖
│   ├── tsconfig.json       # TypeScript 配置
│   ├── wrangler.toml       # Cloudflare Workers 配置
│   └── README.md           # 后端项目说明
└── package.json            # 前端依赖 (已存在)
```

### 核心依赖分析

#### 运行时依赖 (dependencies)

```json
{
  "hono": "^4.0.0", // 轻量级 Web 框架
  "@trpc/server": "^10.45.0", // tRPC 服务端
  "zod": "^3.22.0", // 数据验证
  "@hono/trpc-server": "^0.3.0" // Hono + tRPC 集成
}
```

#### 开发依赖 (devDependencies)

```json
{
  "@types/node": "^20.0.0", // Node.js 类型定义
  "typescript": "^5.3.0", // TypeScript 编译器
  "wrangler": "^3.0.0", // Cloudflare Workers CLI
  "@cloudflare/workers-types": "^4.0.0" // Workers 类型定义
}
```

## 🛠️ 实践操作

### 步骤1：创建后端项目目录

```bash
# 在项目根目录执行
mkdir vue-blog-backend
cd vue-blog-backend

# 创建目录结构
mkdir -p src/{trpc,db,middleware,utils}

# 创建基础文件
touch src/index.ts
touch src/trpc/{router,context,users,articles,comments}.ts
touch src/db/{schema,seed}.sql
touch src/middleware/auth.ts
touch src/utils/{jwt,crypto}.ts
touch tsconfig.json
touch wrangler.toml
touch README.md
```

### 步骤2：初始化 package.json

```bash
# 初始化项目
npm init -y

# 安装运行时依赖
npm install hono @trpc/server zod @hono/trpc-server

# 安装开发依赖
npm install -D @types/node typescript wrangler @cloudflare/workers-types

# 验证安装
npm list
```

**执行结果记录**：

```
安装成功的依赖：_____
遇到的版本冲突：_____
解决方案：_____
```

### 步骤3：配置 package.json 脚本

```json
{
  "name": "vue-blog-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "tsc && wrangler publish --dry-run",
    "deploy": "wrangler publish",
    "db:create": "wrangler d1 create vue-blog",
    "db:local": "wrangler d1 execute vue-blog --local --file=src/db/schema.sql",
    "db:prod": "wrangler d1 execute vue-blog --file=src/db/schema.sql",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@trpc/server": "^10.45.0",
    "zod": "^3.22.0",
    "@hono/trpc-server": "^0.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "wrangler": "^3.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

### 步骤4：配置 TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 步骤5：配置 Wrangler

```toml
# wrangler.toml
name = "vue-blog-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NODE_ENV = "development"

# D1 数据库配置 (稍后配置)
# [[d1_databases]]
# binding = "DB"
# database_name = "vue-blog"
# database_id = "your-database-id"
```

## 🔍 深入思考

### 项目结构设计原则

1. **关注点分离**

   - `trpc/` - API 路由和业务逻辑
   - `db/` - 数据库相关文件
   - `middleware/` - 中间件逻辑
   - `utils/` - 通用工具函数

2. **可扩展性**

   - 模块化的 tRPC 路由设计
   - 清晰的文件命名规范
   - 统一的导入/导出模式

3. **与前端的协作**
   - 共享类型定义
   - 统一的错误处理
   - 一致的 API 设计风格

### 依赖选择说明

- **Hono**: 相比 Express，专为 Workers 优化，启动更快
- **@trpc/server**: 提供类型安全的 RPC 框架
- **Zod**: 运行时数据验证，与 TypeScript 完美集成
- **@hono/trpc-server**: Hono 与 tRPC 的适配器

## ❓ 遇到的问题

### 问题 1：模块系统配置

**问题描述**：ESM vs CommonJS 的选择  
**解决方案**：

```json
// package.json 中设置
"type": "module"

// tsconfig.json 中设置
"module": "ESNext",
"moduleResolution": "bundler"
```

### 问题 2：Cloudflare Workers 类型支持

**问题描述**：Workers 环境的类型定义  
**解决方案**：

```json
// tsconfig.json 中添加
"types": ["@cloudflare/workers-types"]
```

## 🎥 参考资料

1. **[Hono + tRPC 示例](https://hono.dev/middleware/third-party/trpc-server)**

   - 核心要点：如何在 Hono 中集成 tRPC
   - 个人收获：了解了适配器模式的使用

2. **[Cloudflare Workers 项目结构最佳实践](https://developers.cloudflare.com/workers/)**
   - 核心要点：Workers 项目的组织方式
   - 个人收获：学习了边缘计算项目的特殊性

## 💡 个人心得

### 今天最大的收获

从零开始搭建后端项目结构，让我对整个技术栈的组合有了更清晰的认识。特别是理解了 Hono + tRPC 的集成方式。

### 项目结构的重要性

良好的项目结构是后续开发效率的基础，特别是在多人协作的情况下。

### 与前端项目的区别

后端项目更注重：

- 数据处理的安全性和性能
- API 设计的一致性和可扩展性
- 部署环境的特殊性（边缘计算）

## 📋 行动清单

### 今日完成

- [ ] 创建后端项目文件夹结构
- [ ] 配置 package.json 和依赖
- [ ] 设置 TypeScript 和 Wrangler 配置
- [ ] 理解项目架构设计原则

### 明日预习

- [ ] 了解 D1 数据库的 wrangler 命令
- [ ] 准备创建生产和测试数据库
- [ ] 思考环境变量的管理方式

## 🔗 有用链接

- [Hono 官方文档](https://hono.dev/)
- [tRPC 服务端文档](https://trpc.io/docs/server/introduction)
- [Wrangler CLI 命令参考](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers 项目模板](https://github.com/cloudflare/templates)
- [TypeScript 配置参考](https://www.typescriptlang.org/tsconfig)

---

**📝 明日重点**：配置 Cloudflare Workers 开发环境，创建 D1 数据库绑定。
