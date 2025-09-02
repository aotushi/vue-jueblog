# Day 11: 设计 D1 数据库表结构

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 分析现有 MongoDB 集合结构
- [ ] 设计 users 表 SQL schema
- [ ] 设计 articles、comments 等表结构
- [ ] 创建 `schema.sql` 数据库初始化文件

## 📚 学习笔记

### 数据模型转换策略

#### MongoDB → SQL 映射原则

```
1. 文档 (Document) → 表 (Table)
2. 字段 (Field) → 列 (Column)
3. 数组字段 → 关联表 (Join Table)
4. 嵌套对象 → JSON 列 或 关联表
5. ObjectId → UUID (TEXT)
6. 引用关系 → 外键约束 (FOREIGN KEY)
```

### 完整表结构设计

#### 1. 用户表 (users)

```sql
-- 用户主表
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- UUID，替代 MongoDB ObjectId
  phone TEXT UNIQUE NOT NULL,       -- 手机号，登录凭证
  username TEXT NOT NULL,           -- 用户昵称
  password TEXT NOT NULL,           -- 加密后的密码
  avatar TEXT DEFAULT '',           -- 头像URL
  introduc TEXT DEFAULT '',         -- 个人介绍
  position TEXT DEFAULT '',         -- 职位
  company TEXT DEFAULT '',          -- 公司
  jue_power INTEGER DEFAULT 0,      -- 掘金力值
  good_num INTEGER DEFAULT 0,       -- 获得点赞数
  read_num INTEGER DEFAULT 0,       -- 文章阅读数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户表索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_jue_power ON users(jue_power DESC);
```

#### 2. 文章表 (articles)

```sql
-- 文章主表
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,              -- 文章标题
  content TEXT NOT NULL,            -- 文章内容 (Markdown)
  summary TEXT DEFAULT '',          -- 文章摘要 (自动生成或手动填写)
  author_id TEXT NOT NULL,          -- 作者ID
  status TEXT DEFAULT 'draft',      -- 状态: draft, published, archived
  view_count INTEGER DEFAULT 0,     -- 浏览量
  like_count INTEGER DEFAULT 0,     -- 点赞数
  comment_count INTEGER DEFAULT 0,  -- 评论数
  collect_count INTEGER DEFAULT 0,  -- 收藏数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,            -- 发布时间

  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (status IN ('draft', 'published', 'archived'))
);

-- 文章表索引
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_like_count ON articles(like_count DESC);
CREATE INDEX idx_articles_view_count ON articles(view_count DESC);
CREATE INDEX idx_articles_title ON articles(title); -- 用于搜索
```

#### 3. 文章标签表 (article_tags)

```sql
-- 文章标签关联表 (处理 MongoDB 中的 tags 数组)
CREATE TABLE article_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  tag TEXT NOT NULL,                -- 标签名
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, tag)           -- 防止重复标签
);

-- 标签索引
CREATE INDEX idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX idx_article_tags_tag ON article_tags(tag);
CREATE INDEX idx_article_tags_composite ON article_tags(tag, article_id);
```

## 🛠️ 实践操作

### 步骤1：创建完整的 schema.sql

```sql
-- src/db/schema.sql
-- Vue Blog V2 数据库结构初始化

-- 1. 用户表
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

-- 2. 文章表
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT DEFAULT '',
  author_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  collect_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (status IN ('draft', 'published', 'archived'))
);

-- 3. 文章标签表
CREATE TABLE IF NOT EXISTS article_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, tag)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag);
```

### 步骤2：测试数据库结构

```bash
# 初始化数据库
wrangler d1 execute vue-blog-dev --local --file=src/db/schema.sql

# 验证表结构
wrangler d1 execute vue-blog-dev --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# 测试查询
wrangler d1 execute vue-blog-dev --local --command="SELECT COUNT(*) as total FROM users"
```

## 🔍 深入思考

### 数据库设计的关键决策

1. **ID 策略选择**

   - 使用 UUID 而非自增ID，避免分布式环境下的ID冲突
   - 保持与前端 TypeScript 的 string 类型兼容

2. **索引策略**

   - 为常用查询字段创建索引
   - 考虑复合索引优化多条件查询
   - 平衡查询性能和写入性能

3. **外键约束**
   - 使用外键保证数据完整性
   - CASCADE 删除避免孤儿记录

### 与 MongoDB 的主要差异

```javascript
// MongoDB 查询 (V1)
db.articles.find({ author_id: ObjectId("...") })
  .populate('author')
  .sort({ created_at: -1 })

// SQL 查询 (V2)
SELECT a.*, u.username, u.avatar
FROM articles a
JOIN users u ON a.author_id = u.id
WHERE a.author_id = ?
ORDER BY a.created_at DESC
```

## ❓ 遇到的问题

### 问题 1：层级评论的设计复杂性

**问题描述**：如何高效查询和显示嵌套评论  
**解决方案**：

- 添加 `root_id` 字段快速定位评论树
- 使用递归查询或应用层组装评论结构

### 问题 2：全文搜索功能

**问题描述**：SQLite 的全文搜索能力有限  
**解决方案**：

```sql
-- 创建 FTS (Full-Text Search) 虚拟表
CREATE VIRTUAL TABLE articles_fts USING fts5(title, content, tokenize='unicode61');
```

## 🎥 参考资料

- [SQLite 语法文档](https://www.sqlite.org/lang.html)
- [数据库设计最佳实践](https://www.vertabelo.com/blog/database-design-best-practices/)
- [Cloudflare D1 特性](https://developers.cloudflare.com/d1/)

## 💡 个人心得

### 今天最大的收获

完成了从 NoSQL 到 SQL 的完整数据模型设计，深刻理解了两种数据库范式的差异和转换策略。

### 对项目的新理解

良好的数据库设计是系统性能和可维护性的基础，需要在范式化和查询性能之间找到平衡。

## 📋 行动清单

### 今日完成

- [x] 完整的8张表结构设计
- [x] 索引策略和外键约束
- [x] 测试数据和验证脚本
- [x] MongoDB 到 SQL 的转换策略

### 明日预习

- [ ] JWT 认证中间件的具体实现
- [ ] 用户注册和登录的业务逻辑
- [ ] 密码加密和验证策略

## 🔗 有用链接

- [SQLite 语法文档](https://www.sqlite.org/lang.html)
- [数据库设计最佳实践](https://www.vertabelo.com/blog/database-design-best-practices/)
- [Cloudflare D1 限制和特性](https://developers.cloudflare.com/d1/platform/limits/)

---

**📝 明日重点**：实现用户认证模块，包括注册、登录和JWT中间件。
