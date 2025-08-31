# 🚀 仿掘金网站 - Vue3 全栈博客平台

> 基于 Vue 3 + TypeScript + Express + MongoDB 的现代博客平台，模仿掘金网站的核心功能

## 🔗 版本链接

| 版本   | 分支                  | 在线演示                                   | 技术栈                          | 状态      |
| ------ | --------------------- | ------------------------------------------ | ------------------------------- | --------- |
| **V1** | [`v1`](../../tree/v1) | [🌐 在线体验](http://39.106.253.222:8080/) | Vue3 + Express + MongoDB        | ✅ 已部署 |
| **V2** | [`v2`](../../tree/v2) | 🚧 开发中                                  | Vue3 + Hono + tRPC + Cloudflare | 🔄 规划中 |

## ✨ 项目概览

这是一个全栈博客应用，包含前端 SPA 和后端 API 服务，实现了文章发布、用户系统、沸点功能、评论互动等核心功能。

## 🎯 技术栈

### 前端

- **Vue 3** - 组合式 API + `<script setup>`
- **TypeScript** - 类型安全
- **Vite** - 现代化构建工具
- **Element Plus** - UI 组件库
- **Pinia** - 状态管理 + 持久化
- **Vue Router 4** - 客户端路由
- **Axios** - HTTP 客户端
- **ByteMD** - Markdown 编辑器
- **Showdown** - Markdown 渲染

### 后端

- **Node.js + Express** - Web 服务框架
- **MongoDB + Mongoose** - 数据库 + ODM
- **JWT** - 身份验证
- **PM2** - 进程管理

### 工程化

- **ESLint + Prettier** - 代码规范
- **Husky + lint-staged** - Git hooks
- **Commitizen** - 规范化提交
- **Docker** - 容器化部署

## 🏗️ 项目架构

### 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vue 3 SPA     │───▶│   Express API   │───▶│   MongoDB       │
│   (Port: 5173)  │    │   (Port: 3000)  │    │   (Port: 27017) │
│                 │    │                 │    │                 │
│ • Vite 开发服务器 │    │ • RESTful API   │    │ • 文档数据库      │
│ • Element Plus  │    │ • JWT 认证      │    │ • Mongoose ODM  │
│ • Pinia Store   │    │ • 中间件处理     │    │ • 集合设计       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 目录结构

```
vue-jueblog/
├── src/                    # 前端源码
│   ├── components/         # 公共组件
│   │   ├── cus-header/     # 头部组件
│   │   ├── cus-editor/     # Markdown 编辑器
│   │   ├── cus-login/      # 登录组件
│   │   ├── cus-comment/    # 评论组件
│   │   └── mk-render/      # Markdown 渲染
│   ├── pages/              # 页面组件
│   │   ├── Home/           # 首页
│   │   ├── article/        # 文章页
│   │   ├── short-msg/      # 沸点页
│   │   ├── user/           # 用户中心
│   │   ├── message/        # 消息中心
│   │   └── setting/        # 设置页
│   ├── stores/             # Pinia 状态管理
│   ├── request/            # Axios 配置和 API
│   ├── router/             # 路由配置
│   ├── styles/             # 全局样式
│   └── utils/              # 工具函数
├── server/                 # 后端源码
│   ├── config/             # 配置文件
│   │   └── mongo.js        # MongoDB 连接
│   ├── module/             # Mongoose 模型
│   │   ├── users.js        # 用户模型
│   │   ├── articles.js     # 文章模型
│   │   ├── comments.js     # 评论模型
│   │   ├── praises.js      # 点赞模型
│   │   ├── shortmsg.js     # 沸点模型
│   │   ├── follows.js      # 关注模型
│   │   └── messages.js     # 消息模型
│   ├── router/             # 路由处理
│   └── index.js            # 服务入口
├── backend-mockdata/       # Strapi Mock 数据服务
├── docker-compose.yml      # Docker 编排
├── nginx.conf              # Nginx 配置
└── package.json            # 前端依赖
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 16
- **MongoDB** >= 5.0
- **pnpm** (推荐) 或 npm

### 方式一：Docker 部署 (推荐)

```bash
# 1. 克隆项目
git clone https://github.com/your-username/vue-jueblog.git
cd vue-jueblog

# 2. 使用 Docker Compose 一键启动
docker-compose up -d

# 3. 访问应用
# 前端: http://localhost:8080
# API: http://localhost:3000
# MongoDB: localhost:27017
```

### 方式二：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/your-username/vue-jueblog.git
cd vue-jueblog

# 2. 安装前端依赖
pnpm install

# 3. 安装后端依赖
cd server
npm install

# 4. 启动 MongoDB 服务
mongod

# 5. 启动后端服务
npm start
# 或使用 PM2
pm2 start --watch

# 6. 启动前端服务 (新终端)
cd ..
pnpm dev

# 7. 启动 Mock 数据服务 (可选)
cd backend-mockdata
npm install
npm run develop
```

## 📋 核心功能

### 用户系统

- ✅ 用户注册/登录
- ✅ 个人资料管理
- ✅ 用户关注/粉丝
- ✅ 个人主页展示

### 文章系统

- ✅ Markdown 编辑器
- ✅ 文章发布/编辑/删除
- ✅ 文章分类和标签
- ✅ 文章点赞和收藏
- ✅ 文章评论系统
- ✅ 阅读量统计

### 沸点功能

- ✅ 短内容发布
- ✅ 沸点点赞/评论
- ✅ 沸点分类圈子

### 互动功能

- ✅ 评论和回复系统
- ✅ 点赞和收藏
- ✅ 关注和粉丝
- ✅ 消息通知

### 其他特性

- ✅ 响应式设计
- ✅ 暗黑模式支持
- ✅ 搜索功能
- ✅ 分页加载
- ✅ 图片上传

## 🔧 开发指南

### 前端开发

```bash
# 启动开发服务器
pnpm dev              # http://localhost:5173

# 类型检查
pnpm type-check

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

### 后端开发

```bash
cd server

# 启动开发服务器
npm start

# 使用 PM2 监控模式
pm2 start --watch

# 查看 PM2 进程
pm2 list
pm2 logs
```

### 数据库操作

```bash
# 进入 MongoDB Shell
mongosh

# 使用项目数据库
use juejin_blogs

# 查看集合
show collections

# 查看用户数据
db.users.find()
```

## 📊 API 接口

### 用户相关

- `POST /api/users/create` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/info/:id` - 获取用户信息
- `PUT /api/users/update/:id` - 更新用户信息

### 文章相关

- `GET /api/articles/lists` - 文章列表
- `GET /api/articles/detail/:id` - 文章详情
- `POST /api/articles/create` - 创建文章
- `PUT /api/articles/update/:id` - 更新文章
- `POST /api/articles/publish/:id` - 发布文章
- `DELETE /api/articles/remove/:id` - 删除文章

### 互动相关

- `POST /api/praises/toggle` - 点赞/取消点赞
- `POST /api/comments/create` - 创建评论
- `GET /api/comments/list/:source_id` - 评论列表
- `POST /api/follows/toggle` - 关注/取消关注

## 🛠️ 环境配置

### MongoDB 配置

```javascript
// server/config/mongo.js
mongoose.connect('mongodb://127.0.0.1:27017/juejin_blog', {
  user: 'your_username',
  pass: 'your_password',
})
```

### Vite 代理配置

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api2': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api2/, ''),
      },
    },
  },
})
```

### JWT 配置

```javascript
// server/utils/jwt.js
const SECRET_KEY = 'your_secret_key'
const token = jwt.sign(data, SECRET_KEY, { expiresIn: '7d' })
```

## 🧪 测试

### 前端测试

```bash
# 运行单元测试 (待实现)
pnpm test

# 运行 E2E 测试 (待实现)
pnpm test:e2e
```

### API 测试

```bash
# 使用 Postman 或 Thunder Client 测试
# 导入 API 文档或手动测试接口
```

## 📈 部署

### 在线演示地址

🌐 **V1 版本**: [http://39.106.253.222:8080/](http://39.106.253.222:8080/)

- 技术栈: Vue3 + Express + MongoDB
- 部署方式: Docker + Nginx
- 功能完整，可正常体验

### Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 传统部署

```bash
# 前端构建
pnpm build

# 后端部署
cd server
npm install --production
pm2 start ecosystem.config.js
```

## 🔮 路线图

### V1.1 (计划中)

- [ ] 单元测试覆盖
- [ ] E2E 测试
- [ ] 性能优化
- [ ] SEO 优化

### V2.0 (规划中)

🌟 **边缘计算全栈架构升级**

- [ ] 前后端完全分离 (独立仓库)
- [ ] Hono + tRPC 替代 Express + REST
- [ ] Cloudflare D1 替代 MongoDB
- [ ] Cloudflare Workers/Pages 部署
- [ ] 端到端类型安全
- [ ] 零成本边缘计算

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) - Vue 3 UI 组件库
- [Express](https://expressjs.com/) - Node.js Web 框架
- [MongoDB](https://www.mongodb.com/) - 文档数据库
- [掘金](https://juejin.cn/) - 设计灵感来源

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
