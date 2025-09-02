# Day 3: Cloudflare Workers 环境准备

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 注册/登录 Cloudflare 账户
- [ ] 安装 Wrangler CLI：`npm install -g wrangler`
- [ ] 学习 Wrangler 基本命令：`wrangler login`、`wrangler dev`
- [ ] 创建第一个 "Hello World" Worker

## 📚 学习笔记

### Cloudflare Workers 概述

#### 什么是 Cloudflare Workers？

```
边缘计算平台，运行在 Cloudflare 的全球网络上
- 300+ 个数据中心
- V8 JavaScript 引擎
- 超低延迟 (<1ms 冷启动)
- 按请求付费，极低成本
```

#### 核心特性

1. **全球分布**：代码在用户附近执行
2. **零冷启动**：V8 Isolates 技术
3. **标准 Web API**：Fetch、Request、Response
4. **强大生态**：KV存储、D1数据库、R2对象存储

### Wrangler CLI 工具

#### 安装和配置

```bash
# 全局安装
npm install -g wrangler

# 验证安装
wrangler --version

# 登录 Cloudflare
wrangler login
```

#### 常用命令

```bash
# 创建新项目
wrangler generate my-worker

# 本地开发
wrangler dev

# 部署到生产
wrangler publish

# 查看日志
wrangler tail

# 管理 KV 存储
wrangler kv:namespace list
```

## 🛠️ 实践练习

### 步骤1：创建 Worker 项目

```bash
# 创建项目目录
mkdir my-first-worker
cd my-first-worker

# 初始化 wrangler 项目
wrangler init
```

### 步骤2：配置 wrangler.toml

```toml
name = "my-first-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "development"
```

### 步骤3：编写 Worker 代码

```javascript
// src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/') {
      return new Response('Hello from Cloudflare Workers!', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    if (url.pathname === '/api/info') {
      return Response.json({
        message: 'Worker Info',
        timestamp: new Date().toISOString(),
        cf: request.cf, // Cloudflare 提供的请求信息
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}
```

### 步骤4：本地测试

```bash
# 启动开发服务器
wrangler dev

# 测试访问
curl http://localhost:8787/
curl http://localhost:8787/api/info
```

**测试结果记录**：

```
命令执行结果：_____
遇到的错误：_____
解决方案：_____
```

## 🔍 深入思考

### Workers 与传统服务器的区别

| 特性       | 传统服务器    | Cloudflare Workers |
| ---------- | ------------- | ------------------ |
| 部署位置   | 单一数据中心  | 300+ 边缘节点      |
| 冷启动时间 | 秒级          | <1ms               |
| 扩容方式   | 手动/自动扩容 | 无限自动扩容       |
| 计费方式   | 按时间        | 按请求             |
| 运行环境   | Node.js       | V8 Isolates        |

### 与当前项目架构的对比

```
当前架构：
用户 → Nginx → Express Server → MongoDB
     (单点服务器)

升级后架构：
用户 → Cloudflare → Workers → D1
     (边缘节点)      (边缘计算) (边缘数据库)
```

### Workers 的限制和注意事项

1. **运行时限制**

   - CPU 时间：最多 30秒
   - 内存：128MB
   - 请求大小：100MB

2. **API 限制**

   - 不支持 Node.js API
   - 只支持 Web 标准 API
   - 不支持文件系统操作

3. **开发注意事项**
   - 代码需要适配 Web 标准
   - 异步操作需要返回 Promise
   - 环境变量通过 env 参数获取

## ❓ 遇到的问题

### 问题 1：wrangler login 失败

**问题描述**：执行登录命令时出现网络错误  
**可能原因**：网络代理问题  
**解决方案**：

```bash
# 方法1：使用代理
wrangler login --proxy http://proxy:port

# 方法2：手动获取 token
# 访问 https://dash.cloudflare.com/profile/api-tokens
# 创建自定义 token 并配置到 ~/.wrangler/config/default.toml
```

### 问题 2：本地开发服务器启动失败

**问题描述**：**\_**  
**解决方案**：**\_**

## 🎥 参考资料

1. **[Cloudflare Workers 官方文档](https://developers.cloudflare.com/workers/)**

   - 核心要点：边缘计算的基础概念和优势
   - 个人收获：理解了边缘计算与传统服务器架构的区别

2. **[Wrangler CLI 使用指南](https://developers.cloudflare.com/workers/wrangler/)**
   - 核心要点：开发和部署工具链
   - 个人收获：掌握了基本的开发流程

## 💡 个人心得

### 今天最大的收获

Workers 的边缘计算概念很有意思，让后端代码运行在离用户最近的地方，这种架构思路很先进。

### 对项目升级的新理解

从单一服务器迁移到边缘计算，不仅仅是部署方式的改变，更是架构思维的升级。

### 技术栈的协同效果

- Hono：轻量级框架，适合 Workers 环境
- tRPC：类型安全的 API 层
- Workers：全球边缘计算平台
- D1：边缘数据库

三者结合形成了完整的边缘计算解决方案。

## 📋 行动清单

### 今日完成

- [ ] Cloudflare 账户设置
- [ ] Wrangler CLI 安装
- [ ] 第一个 Worker 创建和测试

### 明日预习

- [ ] 了解 D1 数据库基础概念
- [ ] 思考 MongoDB → D1 的迁移策略

## 🔗 有用链接

- [Cloudflare Workers 官方文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Workers 示例代码](https://developers.cloudflare.com/workers/examples/)
- [Workers 定价计算器](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)

---

**📝 明日重点**：学习 Cloudflare D1 数据库，为数据层迁移做准备。
