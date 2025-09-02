# Day 29: 生产环境配置

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 配置生产环境的 wrangler.toml
- [ ] 创建生产环境 D1 数据库
- [ ] 配置环境变量和密钥管理
- [ ] 设置域名和 SSL 证书

## 📚 学习笔记

### 生产环境架构

#### 环境隔离策略

```
开发环境 (development)
├── vue-blog-backend-dev
├── vue-blog-dev (D1 数据库)
└── dev-jwt-secret

生产环境 (production)
├── vue-blog-backend-prod
├── vue-blog-prod (D1 数据库)
└── prod-jwt-secret (加密存储)
```

#### 生产环境 wrangler.toml 配置

```toml
name = "vue-blog-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# 默认开发环境
[vars]
NODE_ENV = "development"
API_VERSION = "v1"

[[d1_databases]]
binding = "DB"
database_name = "vue-blog-dev"
database_id = "dev-database-id"

# 生产环境配置
[env.production]
name = "vue-blog-backend-prod"
route = { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }

[env.production.vars]
NODE_ENV = "production"
API_VERSION = "v1"
CORS_ORIGIN = "https://yourdomain.com"

[[env.production.d1_databases]]
binding = "DB"
database_name = "vue-blog-prod"
database_id = "prod-database-id"

# 生产环境密钥 (通过 wrangler secret 设置)
# JWT_SECRET - 不在配置文件中明文存储
# DATABASE_ENCRYPTION_KEY - 可选的数据加密密钥
```

### 安全配置

#### 环境变量管理

```bash
# 设置生产环境密钥 (不会出现在配置文件中)
wrangler secret put JWT_SECRET --env production
# 输入强密码，如: crypto.randomBytes(64).toString('hex')

# 设置其他敏感配置
wrangler secret put DATABASE_ENCRYPTION_KEY --env production
wrangler secret put ADMIN_API_KEY --env production

# 列出已设置的密钥
wrangler secret list --env production
```

#### JWT 密钥生成

```javascript
// scripts/generate-jwt-secret.js
const crypto = require('crypto')

// 生成 256 位 (32 字节) 的随机密钥
const secret = crypto.randomBytes(32).toString('hex')
console.log('JWT Secret:', secret)

// 生成用于不同环境的密钥
const envSecrets = {
  development: crypto.randomBytes(32).toString('hex'),
  staging: crypto.randomBytes(32).toString('hex'),
  production: crypto.randomBytes(32).toString('hex'),
}

console.log('\n环境密钥:')
console.table(envSecrets)
```

## 🛠️ 实践操作

### 步骤1：创建生产环境数据库

```bash
# 创建生产数据库
wrangler d1 create vue-blog-prod

# 复制输出的配置到 wrangler.toml
# [[env.production.d1_databases]]
# binding = "DB"
# database_name = "vue-blog-prod"
# database_id = "your-prod-database-id"

# 初始化生产数据库结构
wrangler d1 execute vue-blog-prod --file=src/db/schema.sql
```

**创建结果记录**：

```
生产数据库ID: _____
数据库区域: _____
初始化结果: 成功/失败
```

### 步骤2：配置生产环境密钥

```bash
# 生成强密码
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 设置 JWT 密钥
wrangler secret put JWT_SECRET --env production
# 输入生成的强密码

# 设置 CORS 原始域名
wrangler secret put CORS_ORIGIN --env production
# 输入: https://yourdomain.com

# 验证密钥设置
wrangler secret list --env production
```

### 步骤3：域名和路由配置

```bash
# 添加自定义域名 (需要在 Cloudflare DNS 中配置)
wrangler route add "api.yourdomain.com/*" vue-blog-backend-prod

# 或在 wrangler.toml 中配置路由
[env.production]
route = { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
```

### 步骤4：SSL 和安全配置

#### Cloudflare SSL 配置

1. **DNS 设置**

   ```
   Type: CNAME
   Name: api
   Content: vue-blog-backend-prod.your-username.workers.dev
   Proxy: ✅ (橙色云朵)
   ```

2. **SSL/TLS 设置**

   - 加密模式: Full (strict)
   - 最低 TLS 版本: 1.2
   - 启用 HSTS

3. **安全标头**
   ```toml
   # wrangler.toml 中添加
   [env.production.vars]
   SECURITY_HEADERS = "true"
   ```

#### 更新代码添加安全标头

```typescript
// src/middleware/security.ts
import { Context, Next } from 'hono'

export const securityHeaders = async (c: Context, next: Next) => {
  // 生产环境才添加严格安全标头
  if (c.env.NODE_ENV === 'production') {
    c.header(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    )
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('X-XSS-Protection', '1; mode=block')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'",
    )
  }

  await next()
}

// src/index.ts 中使用
import { securityHeaders } from './middleware/security'

app.use('*', securityHeaders)
```

### 步骤5：性能和监控配置

#### 配置分析和监控

```toml
# wrangler.toml
[env.production]
# 启用分析
analytics_engine_datasets = [
  { binding = "ANALYTICS", dataset = "vue-blog-analytics" }
]

# 配置限流
[env.production.vars]
RATE_LIMIT_ENABLED = "true"
RATE_LIMIT_MAX_REQUESTS = "1000"
RATE_LIMIT_WINDOW = "3600"
```

#### 添加性能监控中间件

```typescript
// src/middleware/analytics.ts
export const analytics = async (c: Context, next: Next) => {
  const start = Date.now()

  await next()

  const duration = Date.now() - start

  // 记录分析数据
  if (c.env.ANALYTICS) {
    c.executionCtx.waitUntil(
      c.env.ANALYTICS.writeDataPoint({
        blobs: [
          c.req.path,
          c.req.method,
          c.res.status.toString(),
          c.req.header('user-agent') || 'unknown',
        ],
        doubles: [duration],
        indexes: [c.req.path],
      }),
    )
  }
}
```

### 步骤6：部署前检查清单

```bash
# 创建部署检查脚本
# scripts/pre-deploy-check.sh
#!/bin/bash

echo "🔍 部署前检查..."

# 1. 检查配置文件
if [ ! -f "wrangler.toml" ]; then
  echo "❌ 缺少 wrangler.toml"
  exit 1
fi

# 2. 检查生产环境密钥
secrets=$(wrangler secret list --env production)
if [[ ! $secrets == *"JWT_SECRET"* ]]; then
  echo "❌ 缺少 JWT_SECRET"
  exit 1
fi

# 3. 检查数据库连接
echo "🔍 检查数据库连接..."
wrangler d1 execute vue-blog-prod --command="SELECT 1" > /dev/null
if [ $? -ne 0 ]; then
  echo "❌ 数据库连接失败"
  exit 1
fi

# 4. 运行类型检查
echo "🔍 TypeScript 类型检查..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ 类型检查失败"
  exit 1
fi

echo "✅ 部署前检查通过"
```

## 🔍 深入思考

### 生产环境安全考虑

1. **数据安全**

   - 数据库访问控制
   - 敏感数据加密
   - API 访问限制

2. **网络安全**

   - HTTPS 强制
   - CORS 配置
   - 安全标头

3. **认证安全**
   - JWT 密钥管理
   - Token 过期策略
   - 访问日志记录

### 监控和告警

```javascript
// 错误监控配置
export const errorHandler = (error: Error, c: Context) => {
  // 记录错误到分析平台
  console.error(`Error: ${error.message}`, {
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
    stack: error.stack
  })

  // 生产环境不暴露详细错误信息
  if (c.env.NODE_ENV === 'production') {
    return c.json({ error: 'Internal Server Error' }, 500)
  }

  return c.json({ error: error.message }, 500)
}
```

## ❓ 遇到的问题

### 问题 1：自定义域名 SSL 配置失败

**问题描述**：域名无法正确解析到 Worker  
**解决方案**：

1. 确保域名在 Cloudflare 管理
2. 检查 DNS 记录配置
3. 等待 DNS 传播 (最多48小时)

### 问题 2：生产数据库权限问题

**问题描述**：无法访问生产环境 D1 数据库  
**解决方案**：

```bash
# 检查权限
wrangler whoami
# 确保账户有数据库访问权限

# 重新绑定数据库
wrangler d1 info vue-blog-prod
```

## 🎥 参考资料

1. **[Cloudflare Workers 生产部署](https://developers.cloudflare.com/workers/get-started/guide/)**

   - 核心要点：生产环境的最佳配置实践
   - 个人收获：理解了边缘计算部署的特殊要求

2. **[Web 安全最佳实践](https://owasp.org/www-project-top-ten/)**
   - 核心要点：常见的安全漏洞和防护措施
   - 个人收获：学习了现代 Web 应用的安全标准

## 💡 个人心得

### 今天最大的收获

配置生产环境让我深刻理解了开发环境和生产环境的巨大差异，特别是在安全性和性能方面的要求。

### 安全配置的重要性

生产环境的安全配置不是可选项，而是必需品。每一个安全漏洞都可能导致严重后果。

### Cloudflare 生态的优势

Cloudflare 的一站式解决方案（DNS、CDN、SSL、边缘计算）大大简化了生产环境的配置和管理。

## 📋 行动清单

### 今日完成

- [ ] 配置生产环境 wrangler.toml
- [ ] 创建生产数据库和密钥管理
- [ ] 设置自定义域名和 SSL
- [ ] 添加安全标头和监控

### 明日预习

- [ ] 了解前端生产构建优化
- [ ] 准备 Vite 打包配置调优
- [ ] 思考静态资源缓存策略

## 🔗 有用链接

- [Cloudflare Workers 部署文档](https://developers.cloudflare.com/workers/get-started/guide/)
- [D1 生产环境最佳实践](https://developers.cloudflare.com/d1/tutorials/production-ready-d1/)
- [Web 安全标头配置](https://securityheaders.com/)
- [JWT 安全最佳实践](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Cloudflare SSL 配置指南](https://developers.cloudflare.com/ssl/)

---

**📝 明日重点**：优化前端生产构建，配置静态资源缓存和性能监控。
