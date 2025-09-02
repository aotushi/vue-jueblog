# Day 9: 配置 Cloudflare Workers 环境

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建 `wrangler.toml` 配置文件
- [ ] 配置本地开发环境变量
- [ ] 创建 D1 数据库绑定配置
- [ ] 测试 `wrangler dev` 本地开发服务器

## 📚 学习笔记

### Wrangler 配置详解

#### 基础配置项

```toml
# wrangler.toml
name = "vue-blog-backend"           # Worker 名称
main = "src/index.ts"               # 入口文件
compatibility_date = "2024-01-01"   # 兼容性日期
compatibility_flags = ["nodejs_compat"]  # Node.js 兼容性

# 环境变量
[vars]
NODE_ENV = "development"
JWT_SECRET = "your-jwt-secret-key"
API_VERSION = "v1"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"                      # 在代码中使用的变量名
database_name = "vue-blog"          # 数据库名称
database_id = "your-database-id"    # 数据库 ID (创建后获得)
```

#### 环境配置 (多环境)

```toml
# 开发环境 (默认)
[env.development]
vars = { NODE_ENV = "development", DEBUG = "true" }

# 生产环境
[env.production]
vars = { NODE_ENV = "production", DEBUG = "false" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "vue-blog-prod"
database_id = "your-prod-database-id"
```

### D1 数据库管理

#### 创建数据库命令

```bash
# 创建开发数据库
wrangler d1 create vue-blog-dev

# 创建生产数据库
wrangler d1 create vue-blog-prod

# 列出所有数据库
wrangler d1 list

# 删除数据库
wrangler d1 delete vue-blog-dev
```

#### 数据库操作命令

```bash
# 本地数据库操作
wrangler d1 execute vue-blog-dev --local --command="SELECT 1"
wrangler d1 execute vue-blog-dev --local --file=src/db/schema.sql

# 远程数据库操作
wrangler d1 execute vue-blog-dev --command="SELECT 1"
wrangler d1 execute vue-blog-dev --file=src/db/schema.sql

# 查看数据库信息
wrangler d1 info vue-blog-dev
```

## 🛠️ 实践操作

### 步骤1：创建 D1 数据库

```bash
cd vue-blog-backend

# 创建开发环境数据库
wrangler d1 create vue-blog-dev

# 输出示例：
# ✅ Successfully created DB 'vue-blog-dev' in region WEUR (Western Europe)
#
# [[d1_databases]]
# binding = "DB"
# database_name = "vue-blog-dev"
# database_id = "12345678-1234-1234-1234-123456789012"
```

**创建结果记录**：

```
数据库名称：_____
数据库 ID：_____
所在区域：_____
```

### 步骤2：更新 wrangler.toml 配置

```toml
name = "vue-blog-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NODE_ENV = "development"
JWT_SECRET = "dev-jwt-secret-key-change-in-production"
API_VERSION = "v1"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "vue-blog-dev"
database_id = "your-actual-database-id-here"  # 替换为实际的 ID

# 生产环境配置
[env.production]
name = "vue-blog-backend-prod"

[env.production.vars]
NODE_ENV = "production"
JWT_SECRET = "production-jwt-secret-key"

[[env.production.d1_databases]]
binding = "DB"
database_name = "vue-blog-prod"
database_id = "your-prod-database-id-here"
```

### 步骤3：创建基础数据库表结构

```sql
-- src/db/schema.sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  introduc TEXT DEFAULT '',
  position TEXT DEFAULT '',
  company TEXT DEFAULT '',
  jue_power INTEGER DEFAULT 0,
  good_num INTEGER DEFAULT 0,
  read_num INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
```

### 步骤4：初始化数据库结构

```bash
# 在本地数据库执行 schema
wrangler d1 execute vue-blog-dev --local --file=src/db/schema.sql

# 验证表创建
wrangler d1 execute vue-blog-dev --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# 在远程数据库执行 schema (可选)
wrangler d1 execute vue-blog-dev --file=src/db/schema.sql
```

**执行结果记录**：

```
本地数据库初始化：成功/失败
创建的表：_____
遇到的错误：_____
```

### 步骤5：创建基础 Worker 代码

```typescript
// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  DB: D1Database
  NODE_ENV: string
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

// 中间件
app.use('*', cors())

// 健康检查
app.get('/', c => {
  return c.json({
    message: 'Vue Blog Backend API',
    version: '1.0.0',
    environment: c.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// 数据库测试接口
app.get('/api/db-test', async c => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as test').first()
    return c.json({
      message: 'Database connection successful',
      result,
    })
  } catch (error) {
    return c.json(
      {
        message: 'Database connection failed',
        error: error.message,
      },
      500,
    )
  }
})

// 导出应用
export default app
```

### 步骤6：测试本地开发环境

```bash
# 启动本地开发服务器
wrangler dev

# 在另一个终端测试
curl http://localhost:8787/
curl http://localhost:8787/api/db-test
```

**测试结果记录**：

```
服务启动：成功/失败
基础接口响应：_____
数据库连接测试：_____
```

## 🔍 深入思考

### 环境变量管理策略

1. **开发环境**

   - 使用 `wrangler.toml` 中的 `[vars]`
   - 敏感信息使用 `.dev.vars` 文件

2. **生产环境**

   - 使用 Cloudflare Dashboard 设置
   - 或通过 `wrangler secret put` 命令

3. **最佳实践**

   ```bash
   # 创建 .dev.vars 文件 (不提交到 git)
   echo "JWT_SECRET=your-dev-secret" > .dev.vars
   echo "DB_PASSWORD=dev-password" >> .dev.vars

   # .gitignore 中忽略
   echo ".dev.vars" >> .gitignore
   ```

### D1 数据库的特性和限制

#### 优势

- **边缘分布**：数据靠近用户
- **SQL 兼容**：标准 SQLite 语法
- **自动备份**：Cloudflare 自动处理
- **免费额度**：慷慨的免费使用量

#### 限制

- **数据库大小**：每个数据库最大 10GB
- **查询复杂度**：复杂查询可能有性能影响
- **并发写入**：有一定的写入速度限制

### 本地开发 vs 远程部署

```bash
# 本地开发流程
wrangler dev                    # 启动本地服务器
wrangler d1 execute --local     # 操作本地数据库

# 远程部署流程
wrangler publish                # 部署到 Cloudflare
wrangler d1 execute             # 操作远程数据库
```

## ❓ 遇到的问题

### 问题 1：wrangler dev 启动失败

**问题描述**：端口被占用或配置错误  
**解决方案**：

```bash
# 检查端口占用
netstat -an | grep 8787

# 指定端口启动
wrangler dev --port 8788

# 检查配置文件
wrangler config list
```

### 问题 2：D1 数据库连接失败

**问题描述**：本地开发时数据库未绑定  
**解决方案**：

```bash
# 检查数据库绑定
wrangler d1 list

# 重新绑定数据库
wrangler d1 execute vue-blog-dev --local --command="SELECT 1"
```

## 🎥 参考资料

1. **[Wrangler 配置文档](https://developers.cloudflare.com/workers/wrangler/configuration/)**

   - 核心要点：完整的配置选项和最佳实践
   - 个人收获：理解了多环境配置的管理方式

2. **[D1 数据库文档](https://developers.cloudflare.com/d1/)**
   - 核心要点：D1 的特性、限制和使用方法
   - 个人收获：掌握了边缘数据库的操作方式

## 💡 个人心得

### 今天最大的收获

成功搭建了 Cloudflare Workers 的完整开发环境，特别是理解了本地开发和远程部署的区别。

### D1 数据库的印象

相比传统数据库，D1 的边缘分布特性很有吸引力，但也需要适应其特有的限制。

### 开发流程的变化

从传统的 Node.js + MongoDB 开发切换到 Workers + D1，需要适应新的工具链和开发方式。

## 📋 行动清单

### 今日完成

- [ ] 创建和配置 D1 数据库
- [ ] 设置 wrangler.toml 配置文件
- [ ] 初始化数据库表结构
- [ ] 测试本地开发环境

### 明日预习

- [ ] 了解 tRPC 的基础架构
- [ ] 准备创建第一个 tRPC procedure
- [ ] 思考 JWT 中间件的实现

## 🔗 有用链接

- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [D1 数据库管理](https://developers.cloudflare.com/d1/tutorials/)
- [Cloudflare Workers 环境变量](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Workers 本地开发](https://developers.cloudflare.com/workers/learning/local-development/)
- [SQLite 语法参考](https://www.sqlite.org/lang.html)

---

**📝 明日重点**：搭建 tRPC 基础架构，创建第一个 API procedure。
