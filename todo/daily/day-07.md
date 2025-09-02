# Day 7: 数据迁移策略规划

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 分析现有 MongoDB 数据结构
- [ ] 设计 SQL 表结构映射方案
- [ ] 规划数据迁移脚本架构
- [ ] 制定数据一致性验证方案

## 📚 学习笔记

### 现有 MongoDB 数据结构分析

#### 用户集合 (users)

```javascript
// server/module/users.js
{
  _id: ObjectId("..."),
  phone: "13888888888",        // 手机号，唯一
  username: "用户名",           // 用户名
  password: "encrypted_hash",  // 加密密码
  avatar: "avatar_url",        // 头像URL
  introduc: "个人介绍",         // 个人介绍
  position: "职位",            // 职位
  company: "公司",             // 公司
  jue_power: 0,               // 掘金力
  good_num: 0,                // 点赞数
  read_num: 0,                // 阅读数
  // createdAt, updatedAt (Mongoose 自动添加)
}
```

#### 文章集合 (articles)

```javascript
// server/module/articles.js
{
  _id: ObjectId("..."),
  title: "文章标题",
  content: "文章内容(Markdown)",
  author_id: ObjectId("..."),  // 作者ID，引用 users
  status: "draft|published",   // 文章状态
  tags: ["Vue", "React"],      // 标签数组
  view_count: 0,              // 浏览量
  like_count: 0,              // 点赞数
  comment_count: 0,           // 评论数
  created_at: Date,
  updated_at: Date
}
```

#### 评论集合 (comments)

```javascript
{
  _id: ObjectId("..."),
  content: "评论内容",
  author_id: ObjectId("..."),   // 评论者ID
  source_id: ObjectId("..."),  // 文章或沸点ID
  source_type: "article|shortmsg", // 来源类型
  parent_id: ObjectId("..."),  // 父评论ID（回复功能）
  created_at: Date
}
```

#### 点赞集合 (praises)

```javascript
{
  _id: ObjectId("..."),
  user_id: ObjectId("..."),    // 点赞用户ID
  source_id: ObjectId("..."),  // 被点赞的文章/沸点ID
  source_type: "article|shortmsg|comment",
  created_at: Date
}
```

### SQL 表结构设计

#### 1. 用户表 (users)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- UUID，对应 MongoDB _id
  phone TEXT UNIQUE NOT NULL,       -- 手机号
  username TEXT NOT NULL,           -- 用户名
  password TEXT NOT NULL,           -- 加密密码
  avatar TEXT DEFAULT '',           -- 头像URL
  introduc TEXT DEFAULT '',         -- 个人介绍
  position TEXT DEFAULT '',         -- 职位
  company TEXT DEFAULT '',          -- 公司
  jue_power INTEGER DEFAULT 0,      -- 掘金力
  good_num INTEGER DEFAULT 0,       -- 点赞数
  read_num INTEGER DEFAULT 0,       -- 阅读数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
```

#### 2. 文章表 (articles)

```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,              -- UUID
  title TEXT NOT NULL,              -- 文章标题
  content TEXT NOT NULL,            -- 文章内容
  author_id TEXT NOT NULL,          -- 作者ID
  status TEXT DEFAULT 'draft',      -- 状态：draft, published
  view_count INTEGER DEFAULT 0,     -- 浏览量
  like_count INTEGER DEFAULT 0,     -- 点赞数
  comment_count INTEGER DEFAULT 0,  -- 评论数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);
```

#### 3. 文章标签表 (article_tags)

```sql
-- MongoDB 数组字段 → 关联表
CREATE TABLE article_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,         -- 文章ID
  tag TEXT NOT NULL,                -- 标签名
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, tag)           -- 同一文章不能有重复标签
);

-- 索引
CREATE INDEX idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX idx_article_tags_tag ON article_tags(tag);
```

#### 4. 评论表 (comments)

```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY,              -- UUID
  content TEXT NOT NULL,            -- 评论内容
  author_id TEXT NOT NULL,          -- 评论者ID
  source_id TEXT NOT NULL,          -- 文章/沸点ID
  source_type TEXT NOT NULL,        -- 'article' | 'shortmsg'
  parent_id TEXT,                   -- 父评论ID，NULL表示顶级评论
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (source_type IN ('article', 'shortmsg'))
);

-- 索引
CREATE INDEX idx_comments_source ON comments(source_id, source_type);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
```

#### 5. 点赞表 (praises)

```sql
CREATE TABLE praises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,            -- 点赞用户ID
  source_id TEXT NOT NULL,          -- 被点赞对象ID
  source_type TEXT NOT NULL,        -- 'article' | 'shortmsg' | 'comment'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, source_id, source_type), -- 防止重复点赞
  CHECK (source_type IN ('article', 'shortmsg', 'comment'))
);

-- 索引
CREATE INDEX idx_praises_source ON praises(source_id, source_type);
CREATE INDEX idx_praises_user_id ON praises(user_id);
```

## 🔍 数据迁移策略

### 迁移挑战分析

1. **ID 格式转换**

   ```
   MongoDB ObjectId → SQLite TEXT (UUID)
   例: ObjectId("507f1f77bcf86cd799439011") → "uuid-v4-string"
   ```

2. **数据类型映射**

   ```
   MongoDB Date → SQLite DATETIME (ISO 8601)
   MongoDB Array → SQLite 关联表
   MongoDB 嵌套对象 → SQLite JSON 字段或关联表
   ```

3. **关系完整性**
   ```
   MongoDB 引用 → SQLite 外键约束
   需要确保关联数据的迁移顺序
   ```

### 迁移脚本架构设计

#### 第一阶段：数据导出 (export-mongo.js)

```javascript
// migration-tools/export-mongo.js
const mongoose = require('mongoose')
const fs = require('fs')

// 连接 MongoDB
mongoose.connect('mongodb://localhost:27017/juejin_blog')

async function exportData() {
  const collections = {
    users: require('../server/module/users'),
    articles: require('../server/module/articles'),
    comments: require('../server/module/comments'),
    praises: require('../server/module/praises'),
    // ... 其他集合
  }

  const exportData = {}

  for (const [name, model] of Object.entries(collections)) {
    console.log(`导出 ${name}...`)
    const data = await model.find().lean()

    // 数据预处理
    exportData[name] = data.map(transformDocument)
  }

  // 保存到 JSON 文件
  fs.writeFileSync('./migration-data.json', JSON.stringify(exportData, null, 2))
}

function transformDocument(doc) {
  return {
    ...doc,
    id: generateUUID(), // ObjectId → UUID
    _id: doc._id.toString(), // 保留原始ID用于关系映射
    created_at: doc.createdAt?.toISOString(),
    updated_at: doc.updatedAt?.toISOString(),
  }
}
```

#### 第二阶段：数据导入 (import-d1.js)

```javascript
// migration-tools/import-d1.js
const fs = require('fs')

async function importData() {
  const data = JSON.parse(fs.readFileSync('./migration-data.json'))

  // 按依赖顺序导入
  await importUsers(data.users)
  await importArticles(data.articles)
  await importArticleTags(data.articles) // 处理标签数组
  await importComments(data.comments)
  await importPraises(data.praises)
}

async function importUsers(users) {
  const db = getD1Database()

  for (const user of users) {
    await db
      .prepare(
        `
      INSERT INTO users (id, phone, username, password, avatar, introduc, position, company, jue_power, good_num, read_num, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        user.id,
        user.phone,
        user.username,
        user.password,
        user.avatar || '',
        user.introduc || '',
        user.position || '',
        user.company || '',
        user.jue_power || 0,
        user.good_num || 0,
        user.read_num || 0,
        user.created_at,
        user.updated_at,
      )
      .run()
  }
}
```

### 数据一致性验证

```javascript
// migration-tools/verify-data.js
async function verifyMigration() {
  const mongoData = await getMongoStats()
  const d1Data = await getD1Stats()

  const report = {
    users: {
      mongo: mongoData.users,
      d1: d1Data.users,
      match: mongoData.users === d1Data.users,
    },
    articles: {
      mongo: mongoData.articles,
      d1: d1Data.articles,
      match: mongoData.articles === d1Data.articles,
    },
    // ... 其他表验证
  }

  console.table(report)
  return report
}

async function getMongoStats() {
  return {
    users: await User.countDocuments(),
    articles: await Article.countDocuments(),
    comments: await Comment.countDocuments(),
  }
}

async function getD1Stats() {
  return {
    users: await db.prepare('SELECT COUNT(*) as count FROM users').first()
      .count,
    articles: await db.prepare('SELECT COUNT(*) as count FROM articles').first()
      .count,
    comments: await db.prepare('SELECT COUNT(*) as count FROM comments').first()
      .count,
  }
}
```

## ❓ 遇到的问题

### 问题 1：大数据量迁移性能

**问题描述**：如果数据量很大，逐条插入会很慢  
**解决方案**：

```javascript
// 批量插入优化
async function batchInsert(tableName, records, batchSize = 100) {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const values = batch.map(() => '(?)').join(',')
    const sql = `INSERT INTO ${tableName} VALUES ${values}`
    await db
      .prepare(sql)
      .bind(...batch)
      .run()
  }
}
```

### 问题 2：关联关系的迁移顺序

**问题描述**：外键约束导致导入失败  
**解决方案**：

```javascript
// 迁移顺序规划
const migrationOrder = [
  'users', // 基础表，无外键依赖
  'articles', // 依赖 users
  'article_tags', // 依赖 articles
  'comments', // 依赖 users 和 articles
  'praises', // 依赖 users
]
```

## 💡 个人心得

### 今天最大的收获

数据迁移不仅仅是数据格式的转换，更是数据模型设计的重新思考。从 NoSQL 到 SQL 的转换需要重新梳理数据关系。

### 迁移策略的关键点

1. **保持数据完整性**：确保关联关系正确迁移
2. **性能优化**：批量操作和合理的迁移顺序
3. **可验证性**：提供数据一致性验证机制
4. **可回滚性**：保留原始数据和迁移日志

### 对项目架构升级的影响

数据层的迁移是整个 V2 升级中最关键的一步，需要确保万无一失。

## 📋 行动清单

### 今日完成

- [ ] 分析现有 MongoDB 数据结构
- [ ] 设计对应的 SQL 表结构
- [ ] 规划数据迁移脚本架构
- [ ] 制定数据验证方案

### 明日预习 (Week 2 开始)

- [ ] 创建 vue-blog-backend 项目结构
- [ ] 了解 package.json 配置
- [ ] 准备核心依赖安装

## 🔗 有用链接

- [SQLite 数据类型](https://www.sqlite.org/datatype3.html)
- [MongoDB to SQL 迁移指南](https://www.mongodb.com/developer/products/atlas/migrate-from-sql-to-mongodb/)
- [Cloudflare D1 限制和最佳实践](https://developers.cloudflare.com/d1/platform/limits/)
- [UUID 生成器](https://www.uuidgenerator.net/)
- [数据库设计最佳实践](https://www.vertabelo.com/blog/database-design-best-practices/)

---

**📝 Week 1 总结**：完成了技术栈学习和数据迁移策略设计，为下周的项目实施做好了理论准备。  
**🎯 Week 2 预览**：开始实际搭建后端项目结构，进入动手实践阶段。
