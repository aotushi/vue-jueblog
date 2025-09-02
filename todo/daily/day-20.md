# Day 20: 数据迁移工具开发

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建数据迁移工具项目
- [ ] 设计 MongoDB 数据导出脚本
- [ ] 实现 ID 映射和关系处理
- [ ] 测试数据导出功能

## 📚 学习笔记

### 数据迁移策略设计

#### 数据迁移挑战分析

```
MongoDB → SQLite 迁移挑战:

1. 数据类型转换
   ├── ObjectId → UUID String
   ├── Date → ISO String
   ├── Array → 关联表 / JSON
   └── Nested Object → 关联表

2. 关系维护
   ├── 用户 → 文章关系
   ├── 文章 → 标签关系
   ├── 文章 → 评论关系
   └── 用户 → 点赞关系

3. 数据一致性
   ├── ID 映射保持
   ├── 关系完整性
   ├── 数据格式验证
   └── 缺失数据处理
```

#### 数据迁移架构

```
数据迁移工具架构:

───────────────────────────────
│ MongoDB (数据源)          │
───────────────────────────────
         │ Export
         ↓
───────────────────────────────
│ 数据转换层 (Transform)   │
│ ├── ID Mapper              │
│ ├── Type Converter         │
│ ├── Relation Handler       │
│ └── Data Validator         │
───────────────────────────────
         │ Import
         ↓
───────────────────────────────
│ Cloudflare D1 (目标)      │
───────────────────────────────
```

### 数据映射策略

#### V1 vs V2 数据模型对比

```javascript
// V1 MongoDB 数据结构
{
  // users 集合
  _id: ObjectId('...'),
  phone: '13888888888',
  username: '用户名',
  password: 'hashed_password',
  avatar: '/uploads/avatar.jpg',
  jue_power: 100,
  created_at: ISODate('2024-01-01T00:00:00Z')
}

// articles 集合
{
  _id: ObjectId('...'),
  title: '文章标题',
  content: '文章内容',
  author_id: ObjectId('...'),
  tags: ['Vue', 'JavaScript'],    // 数组字段
  view_count: 100,
  created_at: ISODate('2024-01-01T00:00:00Z')
}

// comments 集合
{
  _id: ObjectId('...'),
  content: '评论内容',
  author_id: ObjectId('...'),
  article_id: ObjectId('...'),
  parent_id: ObjectId('...'),     // 嵌套结构
  created_at: ISODate('2024-01-01T00:00:00Z')
}
```

```sql
-- V2 SQLite 数据结构

-- users 表
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- UUID 替代 ObjectId
  phone TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  jue_power INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- articles 表
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,          -- 外键关系
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- article_tags 表 (将数组字段展开)
CREATE TABLE article_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- comments 表
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  parent_id TEXT,                   -- 层级关系
  root_id TEXT,                     -- 根评论 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

## 🛠️ 实践操作

### 步骤1：创建迁移工具项目结构

```bash
# 创建迁移工具目录
mkdir migration-tools
cd migration-tools

# 初始化 Node.js 项目
npm init -y

# 安装依赖
npm install mongodb better-sqlite3 uuid dotenv chalk
npm install -D @types/node typescript ts-node

# 创建 TypeScript 配置
npx tsc --init
```

```json
// package.json scripts 配置
{
  "name": "vue-blog-migration",
  "version": "1.0.0",
  "description": "MongoDB to D1 migration tool",
  "scripts": {
    "export": "ts-node src/export.ts",
    "import": "ts-node src/import.ts",
    "verify": "ts-node src/verify.ts",
    "migrate": "npm run export && npm run import && npm run verify",
    "build": "tsc",
    "dev": "ts-node --watch"
  },
  "dependencies": {
    "mongodb": "^6.0.0",
    "better-sqlite3": "^9.0.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.2.0",
    "ts-node": "^10.9.0"
  }
}
```

### 步骤2：实现 MongoDB 数据导出

```typescript
// src/export.ts
import { MongoClient, Db } from 'mongodb'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

interface ExportStats {
  users: number
  articles: number
  comments: number
  tags: number
  totalTime: number
}

class MongoExporter {
  private client: MongoClient
  private db: Db
  private idMap: Map<string, string> = new Map() // ObjectId -> UUID 映射

  constructor(
    private connectionString: string,
    private dbName: string,
  ) {
    this.client = new MongoClient(connectionString)
  }

  async connect(): Promise<void> {
    console.log(chalk.blue('🔌 连接到 MongoDB...'))
    await this.client.connect()
    this.db = this.client.db(this.dbName)
    console.log(chalk.green('✓ MongoDB 连接成功'))
  }

  async exportUsers(): Promise<any[]> {
    console.log(chalk.yellow('📤 导出用户数据...'))

    const users = await this.db.collection('users').find({}).toArray()
    const exportedUsers = []

    for (const user of users) {
      const newId = uuidv4()
      this.idMap.set(user._id.toString(), newId)

      const exportedUser = {
        id: newId,
        phone: user.phone || '',
        username: user.username || `user_${newId.slice(0, 8)}`,
        password: user.password || '',
        avatar: user.avatar || '',
        introduc: user.introduc || '',
        position: user.position || '',
        company: user.company || '',
        location: user.location || '',
        website: user.website || '',
        github: user.github || '',
        jue_power: user.jue_power || 0,
        good_num: user.good_num || 0,
        read_num: user.read_num || 0,
        created_at: user.created_at
          ? new Date(user.created_at).toISOString()
          : new Date().toISOString(),
        updated_at: user.updated_at
          ? new Date(user.updated_at).toISOString()
          : new Date().toISOString(),
      }

      exportedUsers.push(exportedUser)
    }

    console.log(chalk.green(`✓ 用户数据导出完成: ${exportedUsers.length} 条`))
    return exportedUsers
  }

  async exportArticles(): Promise<{ articles: any[]; tags: any[] }> {
    console.log(chalk.yellow('📝 导出文章数据...'))

    const articles = await this.db.collection('articles').find({}).toArray()
    const exportedArticles = []
    const exportedTags = []

    for (const article of articles) {
      const newId = uuidv4()
      this.idMap.set(article._id.toString(), newId)

      const authorId = this.idMap.get(article.author_id?.toString())
      if (!authorId) {
        console.warn(
          chalk.orange(`⚠️  文章 ${article.title} 的作者不存在，跳过`),
        )
        continue
      }

      const exportedArticle = {
        id: newId,
        title: article.title || '',
        content: article.content || '',
        summary: this.generateSummary(article.content || ''),
        author_id: authorId,
        status: article.published ? 'published' : 'draft',
        view_count: article.view_count || 0,
        like_count: article.like_count || 0,
        comment_count: article.comment_count || 0,
        collect_count: article.collect_count || 0,
        created_at: article.created_at
          ? new Date(article.created_at).toISOString()
          : new Date().toISOString(),
        updated_at: article.updated_at
          ? new Date(article.updated_at).toISOString()
          : new Date().toISOString(),
        published_at:
          article.published && article.created_at
            ? new Date(article.created_at).toISOString()
            : null,
      }

      exportedArticles.push(exportedArticle)

      // 处理文章标签
      if (article.tags && Array.isArray(article.tags)) {
        for (const tag of article.tags) {
          exportedTags.push({
            id: exportedTags.length + 1, // 自增 ID
            article_id: newId,
            tag: tag.toString(),
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    console.log(
      chalk.green(`✓ 文章数据导出完成: ${exportedArticles.length} 条`),
    )
    console.log(chalk.green(`✓ 文章标签导出完成: ${exportedTags.length} 条`))

    return { articles: exportedArticles, tags: exportedTags }
  }

  async exportComments(): Promise<any[]> {
    console.log(chalk.yellow('💬 导出评论数据...'))

    const comments = await this.db.collection('comments').find({}).toArray()
    const exportedComments = []

    for (const comment of comments) {
      const newId = uuidv4()
      this.idMap.set(comment._id.toString(), newId)

      const authorId = this.idMap.get(comment.author_id?.toString())
      const articleId = this.idMap.get(comment.article_id?.toString())

      if (!authorId || !articleId) {
        console.warn(
          chalk.orange(`⚠️  评论 ${comment._id} 的关联对象不存在，跳过`),
        )
        continue
      }

      // 处理父评论关系
      let parentId = null
      let rootId = null

      if (comment.parent_id) {
        parentId = this.idMap.get(comment.parent_id.toString())

        // 查找根评论（简化处理，实际需要递归查找）
        rootId = parentId // 这里简化处理
      }

      const exportedComment = {
        id: newId,
        content: comment.content || '',
        author_id: authorId,
        source_id: articleId,
        source_type: 'article',
        parent_id: parentId,
        root_id: rootId,
        reply_to_user_id: comment.reply_to_user_id
          ? this.idMap.get(comment.reply_to_user_id.toString())
          : null,
        like_count: comment.like_count || 0,
        created_at: comment.created_at
          ? new Date(comment.created_at).toISOString()
          : new Date().toISOString(),
      }

      exportedComments.push(exportedComment)
    }

    console.log(
      chalk.green(`✓ 评论数据导出完成: ${exportedComments.length} 条`),
    )
    return exportedComments
  }

  async exportAll(): Promise<ExportStats> {
    const startTime = Date.now()

    try {
      await this.connect()

      // 创建导出目录
      const exportDir = join(process.cwd(), 'exports')
      mkdirSync(exportDir, { recursive: true })

      // 1. 导出用户数据
      const users = await this.exportUsers()
      writeFileSync(
        join(exportDir, 'users.json'),
        JSON.stringify(users, null, 2),
      )

      // 2. 导出文章数据
      const { articles, tags } = await this.exportArticles()
      writeFileSync(
        join(exportDir, 'articles.json'),
        JSON.stringify(articles, null, 2),
      )
      writeFileSync(
        join(exportDir, 'article_tags.json'),
        JSON.stringify(tags, null, 2),
      )

      // 3. 导出评论数据
      const comments = await this.exportComments()
      writeFileSync(
        join(exportDir, 'comments.json'),
        JSON.stringify(comments, null, 2),
      )

      // 4. 保存 ID 映射关系
      const idMapObject = Object.fromEntries(this.idMap)
      writeFileSync(
        join(exportDir, 'id_mapping.json'),
        JSON.stringify(idMapObject, null, 2),
      )

      const totalTime = Date.now() - startTime
      const stats: ExportStats = {
        users: users.length,
        articles: articles.length,
        comments: comments.length,
        tags: tags.length,
        totalTime,
      }

      console.log(chalk.blue('\n📋 导出统计:'))
      console.log(chalk.white(`  用户: ${stats.users} 条`))
      console.log(chalk.white(`  文章: ${stats.articles} 条`))
      console.log(chalk.white(`  评论: ${stats.comments} 条`))
      console.log(chalk.white(`  标签: ${stats.tags} 条`))
      console.log(
        chalk.white(`  用时: ${(stats.totalTime / 1000).toFixed(2)} 秒`),
      )

      console.log(chalk.green('\n✓ 数据导出完成！'))

      return stats
    } catch (error) {
      console.error(chalk.red('❌ 导出失败:'), error)
      throw error
    } finally {
      await this.client.close()
    }
  }

  private generateSummary(content: string): string {
    // 简单的摘要生成逻辑
    const plainText = content
      .replace(/<[^>]*>/g, '') // 移除 HTML 标签
      .replace(/[#*`]/g, '') // 移除 Markdown 标记
      .trim()

    return plainText.length > 200
      ? plainText.substring(0, 200) + '...'
      : plainText
  }
}

// 执行导出
async function main() {
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'
    const dbName = process.env.MONGO_DB_NAME || 'vue_blog'

    const exporter = new MongoExporter(mongoUrl, dbName)
    await exporter.exportAll()

    console.log(chalk.green('\n🎉 数据导出任务完成！'))
    process.exit(0)
  } catch (error) {
    console.error(chalk.red('❌ 导出任务失败:'), error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { MongoExporter }
```

### 步骤3：环境配置文件

```env
# .env
# MongoDB 配置
MONGO_URL=mongodb://localhost:27017
MONGO_DB_NAME=vue_blog

# Cloudflare D1 配置 (用于后续导入)
D1_DATABASE_ID=your-d1-database-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id

# 导出设置
EXPORT_BATCH_SIZE=1000
MAX_RETRIES=3
LOG_LEVEL=info
```

### 步骤4：创建数据验证脚本

```typescript
// src/verify.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    users: number
    articles: number
    comments: number
    tags: number
  }
}

class DataValidator {
  private exportDir: string

  constructor() {
    this.exportDir = join(process.cwd(), 'exports')
  }

  async validateExportedData(): Promise<ValidationResult> {
    console.log(chalk.blue('🔍 开始验证导出数据...'))

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: { users: 0, articles: 0, comments: 0, tags: 0 },
    }

    try {
      // 加载数据文件
      const users = JSON.parse(
        readFileSync(join(this.exportDir, 'users.json'), 'utf8'),
      )
      const articles = JSON.parse(
        readFileSync(join(this.exportDir, 'articles.json'), 'utf8'),
      )
      const comments = JSON.parse(
        readFileSync(join(this.exportDir, 'comments.json'), 'utf8'),
      )
      const tags = JSON.parse(
        readFileSync(join(this.exportDir, 'article_tags.json'), 'utf8'),
      )
      const idMapping = JSON.parse(
        readFileSync(join(this.exportDir, 'id_mapping.json'), 'utf8'),
      )

      result.stats = {
        users: users.length,
        articles: articles.length,
        comments: comments.length,
        tags: tags.length,
      }

      // 1. 验证用户数据
      this.validateUsers(users, result)

      // 2. 验证文章数据
      this.validateArticles(articles, users, result)

      // 3. 验证评论数据
      this.validateComments(comments, users, articles, result)

      // 4. 验证关系一致性
      this.validateRelationships(users, articles, comments, tags, result)

      // 5. 验证 ID 映射
      this.validateIdMapping(idMapping, result)

      result.isValid = result.errors.length === 0

      // 输出结果
      console.log(chalk.blue('\n📋 验证统计:'))
      console.log(chalk.white(`  用户: ${result.stats.users} 条`))
      console.log(chalk.white(`  文章: ${result.stats.articles} 条`))
      console.log(chalk.white(`  评论: ${result.stats.comments} 条`))
      console.log(chalk.white(`  标签: ${result.stats.tags} 条`))

      if (result.errors.length > 0) {
        console.log(chalk.red(`\n❌ 验证失败: ${result.errors.length} 个错误`))
        result.errors.forEach(error => console.log(chalk.red(`  - ${error}`)))
      }

      if (result.warnings.length > 0) {
        console.log(
          chalk.yellow(`\n⚠️  警告: ${result.warnings.length} 个问题`),
        )
        result.warnings.forEach(warning =>
          console.log(chalk.yellow(`  - ${warning}`)),
        )
      }

      if (result.isValid) {
        console.log(chalk.green('\n✓ 数据验证通过！'))
      }

      return result
    } catch (error) {
      result.isValid = false
      result.errors.push(`验证过程出错: ${error.message}`)
      return result
    }
  }

  private validateUsers(users: any[], result: ValidationResult): void {
    const phoneSet = new Set<string>()
    const usernameSet = new Set<string>()

    users.forEach((user, index) => {
      // 必要字段检查
      if (!user.id || !user.phone || !user.username) {
        result.errors.push(`用户 ${index} 缺少必要字段`)
      }

      // UUID 格式检查
      if (
        user.id &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          user.id,
        )
      ) {
        result.errors.push(`用户 ${user.username} 的 ID 格式不正确`)
      }

      // 唯一性检查
      if (phoneSet.has(user.phone)) {
        result.errors.push(`用户手机号重复: ${user.phone}`)
      }
      phoneSet.add(user.phone)

      if (usernameSet.has(user.username)) {
        result.warnings.push(`用户名重复: ${user.username}`)
      }
      usernameSet.add(user.username)

      // 日期格式检查
      if (user.created_at && isNaN(Date.parse(user.created_at))) {
        result.errors.push(`用户 ${user.username} 的创建日期格式错误`)
      }
    })
  }

  private validateArticles(
    articles: any[],
    users: any[],
    result: ValidationResult,
  ): void {
    const userIds = new Set(users.map(u => u.id))

    articles.forEach((article, index) => {
      // 必要字段检查
      if (
        !article.id ||
        !article.title ||
        !article.content ||
        !article.author_id
      ) {
        result.errors.push(`文章 ${index} 缺少必要字段`)
      }

      // 作者关系检查
      if (article.author_id && !userIds.has(article.author_id)) {
        result.errors.push(`文章 ${article.title} 的作者不存在`)
      }

      // 状态检查
      if (
        article.status &&
        !['draft', 'published', 'archived'].includes(article.status)
      ) {
        result.errors.push(`文章 ${article.title} 的状态值无效`)
      }
    })
  }

  private validateComments(
    comments: any[],
    users: any[],
    articles: any[],
    result: ValidationResult,
  ): void {
    const userIds = new Set(users.map(u => u.id))
    const articleIds = new Set(articles.map(a => a.id))

    comments.forEach((comment, index) => {
      // 必要字段检查
      if (
        !comment.id ||
        !comment.content ||
        !comment.author_id ||
        !comment.source_id
      ) {
        result.errors.push(`评论 ${index} 缺少必要字段`)
      }

      // 关系检查
      if (comment.author_id && !userIds.has(comment.author_id)) {
        result.errors.push(`评论 ${comment.id} 的作者不存在`)
      }

      if (comment.source_id && !articleIds.has(comment.source_id)) {
        result.errors.push(`评论 ${comment.id} 的文章不存在`)
      }
    })
  }

  private validateRelationships(
    users: any[],
    articles: any[],
    comments: any[],
    tags: any[],
    result: ValidationResult,
  ): void {
    // 验证数据一致性
    const userArticleCount = {}
    const articleCommentCount = {}

    articles.forEach(article => {
      userArticleCount[article.author_id] =
        (userArticleCount[article.author_id] || 0) + 1
    })

    comments.forEach(comment => {
      articleCommentCount[comment.source_id] =
        (articleCommentCount[comment.source_id] || 0) + 1
    })

    // 检查文章评论数一致性
    articles.forEach(article => {
      const actualCount = articleCommentCount[article.id] || 0
      if (article.comment_count !== actualCount) {
        result.warnings.push(
          `文章 ${article.title} 的评论数不一致：存储 ${article.comment_count}，实际 ${actualCount}`,
        )
      }
    })
  }

  private validateIdMapping(idMapping: any, result: ValidationResult): void {
    const mappingCount = Object.keys(idMapping).length
    console.log(chalk.white(`  ID映射: ${mappingCount} 条`))

    // 检查是否有重复的 UUID
    const uuidSet = new Set(Object.values(idMapping))
    if (uuidSet.size !== mappingCount) {
      result.errors.push('ID映射中存在重复的 UUID')
    }
  }
}

// 执行验证
async function main() {
  try {
    const validator = new DataValidator()
    const result = await validator.validateExportedData()

    process.exit(result.isValid ? 0 : 1)
  } catch (error) {
    console.error(chalk.red('❌ 验证任务失败:'), error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { DataValidator }
```

## 🔍 深入思考

### 数据迁移的性能优化

#### 流式处理大数据集

```typescript
// 流式处理策略
const BATCH_SIZE = 1000

function* batchProcessor<T>(items: T[], batchSize: number) {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize)
  }
}

async function exportLargeCollection(collection: any) {
  const cursor = collection.find({}).batchSize(1000)
  const results = []

  while (await cursor.hasNext()) {
    const batch = []

    for (let i = 0; i < BATCH_SIZE && (await cursor.hasNext()); i++) {
      batch.push(await cursor.next())
    }

    const processed = batch.map(transform)
    results.push(...processed)

    // 防止内存溢出，定期清理
    if (results.length > 10000) {
      await flushToDisk(results)
      results.length = 0
    }
  }

  return results
}
```

#### 错误处理和重试机制

```typescript
class RetryHandler {
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        if (attempt < maxRetries) {
          console.warn(`第 ${attempt + 1} 次尝试失败，${delay}ms 后重试...`)
          await this.sleep(delay * Math.pow(2, attempt)) // 指数退避
        }
      }
    }

    throw lastError
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

## ❓ 遇到的问题

### 问题 1：ObjectId 到 UUID 的一致性映射

**问题描述**：确保所有关联对象的 ID 映射一致  
**解决方案**：

1. 先导出所有用户，建立 ID 映射表
2. 按依赖顺序处理：用户 → 文章 → 评论
3. 保存完整的 ID 映射关系

### 问题 2：大数据集内存溢出

**问题描述**：一次性加载所有数据导致内存不足  
**解决方案**：

```typescript
// 分批处理大数据集
async function exportInBatches(collection: any, batchSize = 1000) {
  let skip = 0
  let allResults = []

  while (true) {
    const batch = await collection
      .find({})
      .skip(skip)
      .limit(batchSize)
      .toArray()

    if (batch.length === 0) break

    const processed = batch.map(transform)
    allResults.push(...processed)

    skip += batchSize

    // 防止内存溢出
    if (skip % 10000 === 0) {
      console.log(`已处理 ${skip} 条记录`)
    }
  }

  return allResults
}
```

### 问题 3：数据类型转换错误

**问题描述**：日期、数组、嵌套对象的转换失败  
**解决方案**：

```typescript
class TypeConverter {
  convertDate(value: any): string {
    if (!value) return new Date().toISOString()
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return new Date(value).toISOString()
    return new Date().toISOString()
  }

  convertArray(arr: any[]): string {
    if (!Array.isArray(arr)) return '[]'
    return JSON.stringify(arr)
  }

  sanitizeString(value: any): string {
    if (typeof value !== 'string') return String(value || '')
    return value.replace(/[\x00-\x1f\x7f]/g, '') // 移除控制字符
  }
}
```

## 💡 个人心得

### 今天最大的收获

设计并实现了完整的数据迁移工具，理解了 NoSQL 到 SQL 迁移的复杂性和最佳实践。

### 数据迁移的关键原则

1. **数据一致性优先**：确保关系完整性比性能更重要
2. **分批处理**：避免内存溢出和超时问题
3. **容错设计**：预期错误情况并提供恢复机制
4. **验证机制**：确保迁移结果的正确性

## 📋 行动清单

### 今日完成

- [x] 创建数据迁移工具项目架构
- [x] 实现 MongoDB 数据导出功能
- [x] 设计 ID 映射和关系处理机制
- [x] 创建数据验证和错误处理功能

### 明日预习

- [ ] 了解 Cloudflare D1 的 API 操作
- [ ] 思考批量数据导入策略
- [ ] 准备数据同步和一致性检查

## 🔗 有用链接

- [MongoDB Node.js Driver](https://docs.mongodb.com/drivers/node/current/)
- [数据迁移最佳实践](https://cloud.google.com/architecture/database-migration-concepts-principles-part-1)
- [UUID 生成器](https://github.com/uuidjs/uuid)

---

**📝 明日重点**：实现数据导入功能，将导出的数据批量导入到 Cloudflare D1。
