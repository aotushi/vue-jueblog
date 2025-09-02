# Day 4: Cloudflare D1 数据库学习

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 了解 [Cloudflare D1](https://developers.cloudflare.com/d1/) 基础概念
- [ ] 学习 D1 vs MongoDB 的区别（SQL vs NoSQL）
- [ ] 创建测试 D1 数据库：`wrangler d1 create test-db`
- [ ] 学习基本 SQL 语法（用于后续数据迁移）

## 📚 学习笔记

### Cloudflare D1 概述

#### 什么是 D1？

```
Cloudflare 的边缘 SQLite 数据库
- 基于 SQLite 构建
- 全球分布式（边缘数据库）
- 与 Workers 原生集成
- ACID 事务支持
- 免费额度慷慨
```

#### D1 的特点

1. **边缘分布**：数据存储在多个地理位置
2. **SQLite 兼容**：标准 SQL 语法
3. **强一致性**：支持 ACID 事务
4. **无限扩展**：按需扩容
5. **低延迟访问**：与 Workers 协同工作

### D1 vs MongoDB 对比

| 特性     | MongoDB (当前) | Cloudflare D1 |
| -------- | -------------- | ------------- |
| 数据模型 | 文档型 (NoSQL) | 关系型 (SQL)  |
| 查询语言 | MongoDB Query  | SQL           |
| 事务支持 | 有限支持       | 完整 ACID     |
| 扩展方式 | 垂直/水平扩展  | 自动边缘扩展  |
| 成本     | 需要服务器     | 极低成本      |
| 运维     | 需要维护       | 完全托管      |

### 数据迁移策略思考

#### 当前 MongoDB 结构

```javascript
// 用户文档
{
  _id: ObjectId("..."),
  phone: "13888888888",
  username: "用户名",
  password: "加密密码",
  avatar: "头像URL",
  introduc: "个人介绍",
  createdAt: Date,
}

// 文章文档
{
  _id: ObjectId("..."),
  title: "文章标题",
  content: "文章内容",
  author_id: ObjectId("..."),
  tags: ["tag1", "tag2"],
  created_at: Date,
}
```

#### 对应 D1 表结构设计

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,  -- 对应 MongoDB 的 _id
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文章表
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 文章标签表（处理 MongoDB 的数组字段）
CREATE TABLE article_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

## 🛠️ 实践练习

### 步骤1：创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create vue-blog-test

# 输出示例：
# ✅ Successfully created DB 'vue-blog-test' in region WEUR (Western Europe)
# Created your database using D1's new storage backend.
#
# [[d1_databases]]
# binding = "DB"
# database_name = "vue-blog-test"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 步骤2：配置 wrangler.toml

```toml
name = "d1-test"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "vue-blog-test"
database_id = "your-database-id-here"
```

### 步骤3：创建测试表

```bash
# 创建 schema.sql 文件
cat > schema.sql << EOF
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (id, phone, username, email) VALUES
('1', '13888888888', 'testuser1', 'test1@example.com'),
('2', '13999999999', 'testuser2', 'test2@example.com');
EOF

# 执行 SQL（本地测试）
wrangler d1 execute vue-blog-test --local --file=schema.sql

# 执行 SQL（远程数据库）
wrangler d1 execute vue-blog-test --file=schema.sql
```

### 步骤4：测试数据库查询

```javascript
// src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/api/users') {
      // 查询所有用户
      const { results } = await env.DB.prepare('SELECT * FROM users').all()

      return Response.json(results)
    }

    if (url.pathname.startsWith('/api/users/')) {
      const userId = url.pathname.split('/')[3]

      // 查询单个用户
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(userId)
        .first()

      if (!user) {
        return new Response('User not found', { status: 404 })
      }

      return Response.json(user)
    }

    return new Response('Hello D1!')
  },
}
```

**测试结果记录**：

```bash
# 测试命令
wrangler dev
curl http://localhost:8787/api/users
curl http://localhost:8787/api/users/1

# 结果
执行结果：_____
遇到问题：_____
解决方案：_____
```

## 🔍 深入思考

### 数据迁移的挑战

1. **数据类型转换**

   ```
   MongoDB → D1
   ObjectId → TEXT (UUID或自定义ID)
   Date → DATETIME
   Array → 关联表
   嵌套对象 → JSON 字段或关联表
   ```

2. **关系设计**

   - MongoDB 的引用关系 → D1 的外键关系
   - 多对多关系需要中间表
   - 数组字段需要拆分成关联表

3. **查询优化**
   - 需要为频繁查询的字段创建索引
   - 复杂聚合查询的 SQL 实现
   - 分页查询的优化

### D1 的优势和限制

#### 优势

- **成本极低**：免费额度很高
- **性能优秀**：边缘访问，低延迟
- **易于管理**：完全托管，无需运维
- **强一致性**：ACID 事务支持

#### 限制

- **数据库大小**：单个数据库最大 10GB
- **并发连接**：有连接数限制
- **SQL 方言**：SQLite 语法，有些高级特性不支持

## ❓ 遇到的问题

### 问题 1：D1 数据库创建失败

**问题描述**：执行 create 命令时权限错误  
**可能原因**：Cloudflare 账户权限或配额问题  
**解决方案**：

```bash
# 检查账户状态
wrangler whoami

# 检查 D1 配额
wrangler d1 list
```

### 问题 2：本地 vs 远程数据库同步

**问题描述**：本地测试数据与远程不一致  
**解决方案**：

```bash
# 明确区分本地和远程操作
wrangler d1 execute DB --local --command="SELECT * FROM users"
wrangler d1 execute DB --command="SELECT * FROM users"
```

## 🎥 参考资料

1. **[D1 官方文档](https://developers.cloudflare.com/d1/)**

   - 核心要点：边缘数据库的概念和基本用法
   - 个人收获：理解了 SQL vs NoSQL 在边缘计算场景下的权衡

2. **[SQLite 语法参考](https://www.sqlite.org/lang.html)**
   - 核心要点：D1 基于 SQLite，需要掌握基本语法
   - 个人收获：复习了 SQL 基础，为数据迁移做准备

## 💡 个人心得

### 今天最大的收获

理解了从 NoSQL 到 SQL 的思维转换，特别是如何处理 MongoDB 的嵌套数据和数组字段。

### 对数据迁移的思考

不是简单的数据格式转换，而是需要重新设计数据模型，这可能是整个升级过程中最复杂的部分。

### 与前几天学习的关联

- Workers (计算层) + D1 (存储层) 形成完整边缘计算方案
- Hono 提供轻量级 Web 框架
- tRPC 提供类型安全的 API 层

## 📋 行动清单

### 今日完成

- [ ] D1 基础概念学习
- [ ] 测试数据库创建和查询
- [ ] 数据迁移策略初步设计

### 明日预习

- [ ] TypeScript 高级类型复习
- [ ] Zod 数据验证库学习
- [ ] 思考 API 层的数据验证策略

## 🔗 有用链接

- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [SQLite 官方文档](https://www.sqlite.org/docs.html)
- [SQL vs NoSQL 比较](https://www.mongodb.com/nosql-explained/nosql-vs-sql)
- [数据库设计最佳实践](https://www.vertabelo.com/blog/database-design-best-practices/)
- [D1 定价信息](https://developers.cloudflare.com/d1/platform/pricing/)

---

**📝 明日重点**：学习 TypeScript 高级特性和 Zod 验证，为构建类型安全的 API 做准备。
