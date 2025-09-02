# Day 21: 数据导入到 D1 功能

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 实现 D1 数据库批量导入功能
- [ ] 处理事务和错误回滚机制
- [ ] 创建数据一致性检查工具
- [ ] 测试完整的迁移流程

## 📚 学习笔记

### Cloudflare D1 批量导入策略

#### D1 数据库特性和限制

```
Cloudflare D1 特性:
├── 基于 SQLite 3.x
├── 分布式边缘存储
├── 支持标准 SQL 语法
├── 内置事务支持
├── ACID 兼容性保证
└── 全球边缘复制

操作限制:
├── 单次查询最大 25MB
├── 事务超时 30 秒
├── 并发连接限制
├── 批量操作建议 <1000 条
└── 写入频率限制
```

#### 批量导入架构设计

```
数据导入流水线:

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ JSON 数据文件   │───▶│ 数据预处理      │───▶│ 批量写入 D1     │
│ - users.json    │    │ - 数据验证      │    │ - 事务管理      │
│ - articles.json │    │ - 格式转换      │    │ - 错误处理      │
│ - comments.json │    │ - 依赖排序      │    │ - 进度跟踪      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 数据导入流程设计

#### 导入顺序和依赖关系

```typescript
// 数据导入必须按依赖顺序执行
const IMPORT_ORDER = [
  'users', // 1. 用户表（无依赖）
  'articles', // 2. 文章表（依赖用户）
  'article_tags', // 3. 标签表（依赖文章）
  'comments', // 4. 评论表（依赖用户、文章）
  'praises', // 5. 点赞表（依赖用户、文章、评论）
  'user_stats', // 6. 统计表（依赖用户）
]
```

## 🛠️ 实践操作

### 步骤1：实现 D1 数据导入器

```typescript
// src/import.ts
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config()

interface ImportStats {
  tables: Record<string, number>
  totalRecords: number
  totalTime: number
  errors: string[]
}

interface ImportResult {
  success: boolean
  stats: ImportStats
  message: string
}

class D1Importer {
  private db: Database.Database
  private batchSize: number = 500

  constructor(private dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL') // 优化并发性能
    this.db.pragma('synchronous = NORMAL') // 平衡安全和性能
  }

  async importAll(): Promise<ImportResult> {
    console.log(chalk.blue('🚀 开始数据导入到 D1...'))

    const startTime = Date.now()
    const stats: ImportStats = {
      tables: {},
      totalRecords: 0,
      totalTime: 0,
      errors: [],
    }

    try {
      // 1. 首先创建表结构
      await this.createTables()

      // 2. 按依赖顺序导入数据
      const importOrder = [
        { file: 'users.json', table: 'users' },
        { file: 'articles.json', table: 'articles' },
        { file: 'article_tags.json', table: 'article_tags' },
        { file: 'comments.json', table: 'comments' },
      ]

      for (const { file, table } of importOrder) {
        console.log(chalk.yellow(`📥 导入 ${table} 数据...`))

        const count = await this.importTable(file, table)
        stats.tables[table] = count
        stats.totalRecords += count

        console.log(chalk.green(`✓ ${table} 导入完成: ${count} 条记录`))
      }

      // 3. 创建索引（在数据导入后创建，提高导入速度）
      await this.createIndexes()

      // 4. 验证数据完整性
      await this.validateImport()

      stats.totalTime = Date.now() - startTime

      console.log(chalk.blue('\\n📊 导入统计:'))
      Object.entries(stats.tables).forEach(([table, count]) => {
        console.log(chalk.white(`  ${table}: ${count} 条`))
      })
      console.log(chalk.white(`  总记录数: ${stats.totalRecords}`))
      console.log(
        chalk.white(`  用时: ${(stats.totalTime / 1000).toFixed(2)} 秒`),
      )

      console.log(chalk.green('\\n🎉 数据导入成功完成！'))

      return {
        success: true,
        stats,
        message: '数据导入完成',
      }
    } catch (error) {
      stats.errors.push(error.message)
      console.error(chalk.red('❌ 数据导入失败:'), error)

      return {
        success: false,
        stats,
        message: `导入失败: ${error.message}`,
      }
    } finally {
      this.db.close()
    }
  }

  private async createTables(): Promise<void> {
    console.log(chalk.yellow('🏗️  创建数据库表结构...'))

    const schema = `
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
        location TEXT DEFAULT '',
        website TEXT DEFAULT '',
        github TEXT DEFAULT '',
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
      
      -- 文章标签表
      CREATE TABLE IF NOT EXISTS article_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        UNIQUE(article_id, tag)
      );
      
      -- 评论表
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        author_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        parent_id TEXT,
        root_id TEXT,
        reply_to_user_id TEXT,
        like_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (source_type IN ('article', 'comment', 'user'))
      );
      
      -- 点赞收藏表
      CREATE TABLE IF NOT EXISTS praises (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        action_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, source_id, source_type, action_type),
        CHECK (source_type IN ('article', 'comment', 'user')),
        CHECK (action_type IN ('like', 'collect', 'follow'))
      );
      
      -- 用户统计表
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY,
        article_count INTEGER DEFAULT 0,
        published_count INTEGER DEFAULT 0,
        draft_count INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0,
        total_likes INTEGER DEFAULT 0,
        total_comments INTEGER DEFAULT 0,
        follower_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `

    // 使用事务创建所有表
    const transaction = this.db.transaction(() => {
      this.db.exec(schema)
    })

    transaction()
    console.log(chalk.green('✓ 数据库表结构创建完成'))
  }

  private async importTable(
    filename: string,
    tablename: string,
  ): Promise<number> {
    const exportDir = join(process.cwd(), 'exports')
    const filePath = join(exportDir, filename)

    let data: any[]
    try {
      const fileContent = readFileSync(filePath, 'utf8')
      data = JSON.parse(fileContent)
    } catch (error) {
      console.warn(chalk.orange(`⚠️  文件 ${filename} 不存在或格式错误，跳过`))
      return 0
    }

    if (!data || data.length === 0) {
      console.warn(chalk.orange(`⚠️  ${tablename} 数据为空，跳过`))
      return 0
    }

    // 根据表名生成插入语句
    const insertSQL = this.generateInsertSQL(tablename, data[0])
    const insertStmt = this.db.prepare(insertSQL)

    // 分批插入数据
    let totalInserted = 0
    const batches = this.createBatches(data, this.batchSize)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      // 使用事务批量插入
      const transaction = this.db.transaction(() => {
        for (const record of batch) {
          try {
            const values = this.extractValues(record, tablename)
            insertStmt.run(...values)
            totalInserted++
          } catch (error) {
            console.warn(chalk.orange(`⚠️  插入记录失败: ${error.message}`))
            console.warn(
              chalk.gray(
                `   数据: ${JSON.stringify(record).substring(0, 100)}...`,
              ),
            )
          }
        }
      })

      transaction()

      // 显示进度
      const progress = (((i + 1) / batches.length) * 100).toFixed(1)
      process.stdout.write(
        `\\r   进度: ${progress}% (${totalInserted}/${data.length})`,
      )
    }

    console.log('') // 换行
    return totalInserted
  }

  private generateInsertSQL(tablename: string, sampleRecord: any): string {
    const columns = Object.keys(sampleRecord).filter(
      key => sampleRecord[key] !== undefined,
    )
    const placeholders = columns.map(() => '?').join(', ')

    return `INSERT OR IGNORE INTO ${tablename} (${columns.join(', ')}) VALUES (${placeholders})`
  }

  private extractValues(record: any, tablename: string): any[] {
    const values = []

    for (const [key, value] of Object.entries(record)) {
      if (value === undefined) continue

      // 处理特殊数据类型
      if (value === null) {
        values.push(null)
      } else if (typeof value === 'boolean') {
        values.push(value ? 1 : 0)
      } else if (Array.isArray(value)) {
        values.push(JSON.stringify(value))
      } else if (typeof value === 'object') {
        values.push(JSON.stringify(value))
      } else {
        values.push(value)
      }
    }

    return values
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private async createIndexes(): Promise<void> {
    console.log(chalk.yellow('🔍 创建数据库索引...'))

    const indexes = `
      -- 用户表索引
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      
      -- 文章表索引
      CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
      CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
      CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
      
      -- 标签表索引
      CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id);
      CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag);
      
      -- 评论表索引
      CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
      CREATE INDEX IF NOT EXISTS idx_comments_source_id ON comments(source_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
      
      -- 点赞表索引
      CREATE INDEX IF NOT EXISTS idx_praises_user_id ON praises(user_id);
      CREATE INDEX IF NOT EXISTS idx_praises_source ON praises(source_id, source_type);
      CREATE INDEX IF NOT EXISTS idx_praises_composite ON praises(source_id, source_type, action_type);
    `

    this.db.exec(indexes)
    console.log(chalk.green('✓ 数据库索引创建完成'))
  }

  private async validateImport(): Promise<void> {
    console.log(chalk.yellow('🔍 验证数据完整性...'))

    // 统计各表记录数
    const tables = ['users', 'articles', 'article_tags', 'comments']
    const counts = {}

    for (const table of tables) {
      const result = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${table}`)
        .get()
      counts[table] = result.count
    }

    // 验证外键约束
    const validationQueries = [
      {
        name: '孤立文章检查',
        query: `SELECT COUNT(*) as count FROM articles a 
                LEFT JOIN users u ON a.author_id = u.id 
                WHERE u.id IS NULL`,
      },
      {
        name: '孤立评论检查',
        query: `SELECT COUNT(*) as count FROM comments c 
                LEFT JOIN users u ON c.author_id = u.id 
                WHERE u.id IS NULL`,
      },
      {
        name: '孤立标签检查',
        query: `SELECT COUNT(*) as count FROM article_tags t 
                LEFT JOIN articles a ON t.article_id = a.id 
                WHERE a.id IS NULL`,
      },
    ]

    for (const validation of validationQueries) {
      const result = this.db.prepare(validation.query).get()
      if (result.count > 0) {
        console.warn(
          chalk.orange(`⚠️  ${validation.name}: ${result.count} 条异常记录`),
        )
      } else {
        console.log(chalk.green(`✓ ${validation.name}: 通过`))
      }
    }

    console.log(chalk.blue('\\n📊 数据统计:'))
    Object.entries(counts).forEach(([table, count]) => {
      console.log(chalk.white(`  ${table}: ${count} 条`))
    })
  }
}

// 主执行函数
async function main() {
  try {
    const dbPath = process.env.D1_LOCAL_PATH || './local.db'

    console.log(chalk.blue(`📂 使用数据库: ${dbPath}`))

    const importer = new D1Importer(dbPath)
    const result = await importer.importAll()

    if (result.success) {
      console.log(chalk.green('\\n🎊 数据导入任务完成！'))
      process.exit(0)
    } else {
      console.log(chalk.red('\\n💥 数据导入失败'))
      process.exit(1)
    }
  } catch (error) {
    console.error(chalk.red('❌ 导入任务异常:'), error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { D1Importer }
```

### 步骤2：创建生产环境导入脚本

```typescript
// src/import-to-d1.ts (用于生产环境 D1)
import { readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config()

interface CloudflareD1Client {
  accountId: string
  databaseId: string
  apiToken: string
}

class CloudflareD1Importer {
  private client: CloudflareD1Client

  constructor() {
    this.client = {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      databaseId: process.env.D1_DATABASE_ID!,
      apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    }

    if (
      !this.client.accountId ||
      !this.client.databaseId ||
      !this.client.apiToken
    ) {
      throw new Error('缺少必要的 Cloudflare 配置')
    }
  }

  async importToD1(): Promise<void> {
    console.log(chalk.blue('☁️  开始导入到 Cloudflare D1...'))

    try {
      // 1. 创建表结构
      await this.createTablesInD1()

      // 2. 导入数据
      const importOrder = [
        { file: 'users.json', table: 'users' },
        { file: 'articles.json', table: 'articles' },
        { file: 'article_tags.json', table: 'article_tags' },
        { file: 'comments.json', table: 'comments' },
      ]

      for (const { file, table } of importOrder) {
        await this.importTableToD1(file, table)
      }

      // 3. 创建索引
      await this.createIndexesInD1()

      console.log(chalk.green('\\n🎉 D1 数据导入完成！'))
    } catch (error) {
      console.error(chalk.red('❌ D1 导入失败:'), error)
      throw error
    }
  }

  private async executeD1Query(sql: string, params: any[] = []): Promise<any> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.client.accountId}/d1/database/${this.client.databaseId}/query`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.client.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`D1 查询失败: ${response.status} ${error}`)
    }

    return await response.json()
  }

  private async createTablesInD1(): Promise<void> {
    console.log(chalk.yellow('🏗️  在 D1 中创建表结构...'))

    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        introduc TEXT DEFAULT '',
        position TEXT DEFAULT '',
        company TEXT DEFAULT '',
        location TEXT DEFAULT '',
        website TEXT DEFAULT '',
        github TEXT DEFAULT '',
        jue_power INTEGER DEFAULT 0,
        good_num INTEGER DEFAULT 0,
        read_num INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `

    await this.executeD1Query(schema)
    console.log(chalk.green('✓ D1 表结构创建完成'))
  }

  private async importTableToD1(
    filename: string,
    tablename: string,
  ): Promise<void> {
    console.log(chalk.yellow(`📥 导入 ${tablename} 到 D1...`))

    const exportDir = join(process.cwd(), 'exports')
    const filePath = join(exportDir, filename)

    let data: any[]
    try {
      const fileContent = readFileSync(filePath, 'utf8')
      data = JSON.parse(fileContent)
    } catch (error) {
      console.warn(chalk.orange(`⚠️  文件 ${filename} 不存在，跳过`))
      return
    }

    if (!data || data.length === 0) {
      console.warn(chalk.orange(`⚠️  ${tablename} 数据为空，跳过`))
      return
    }

    // 分批插入（D1 有查询大小限制）
    const batchSize = 100
    const batches = this.createBatches(data, batchSize)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      // 构建批量插入语句
      const insertSQL = this.buildBatchInsertSQL(tablename, batch)

      try {
        await this.executeD1Query(insertSQL)

        const progress = (((i + 1) / batches.length) * 100).toFixed(1)
        process.stdout.write(`\\r   进度: ${progress}%`)
      } catch (error) {
        console.error(chalk.red(`\\n   批次 ${i + 1} 导入失败:`, error.message))
      }
    }

    console.log(
      chalk.green(`\\n✓ ${tablename} 导入完成: ${data.length} 条记录`),
    )
  }

  private buildBatchInsertSQL(tablename: string, records: any[]): string {
    if (records.length === 0) return ''

    const columns = Object.keys(records[0])
    const values = records.map(record => {
      const valueList = columns.map(col => {
        const value = record[col]
        if (value === null || value === undefined) return 'NULL'
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
        if (typeof value === 'boolean') return value ? '1' : '0'
        return value.toString()
      })
      return `(${valueList.join(', ')})`
    })

    return `INSERT OR IGNORE INTO ${tablename} (${columns.join(', ')}) VALUES ${values.join(', ')}`
  }

  private async createIndexesInD1(): Promise<void> {
    console.log(chalk.yellow('🔍 在 D1 中创建索引...'))

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)',
      'CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id)',
      'CREATE INDEX IF NOT EXISTS idx_comments_source_id ON comments(source_id)',
    ]

    for (const indexSQL of indexes) {
      try {
        await this.executeD1Query(indexSQL)
      } catch (error) {
        console.warn(chalk.orange(`⚠️  索引创建失败: ${error.message}`))
      }
    }

    console.log(chalk.green('✓ D1 索引创建完成'))
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }
}

// 主执行函数
async function main() {
  try {
    const importer = new CloudflareD1Importer()
    await importer.importToD1()

    console.log(chalk.green('\\n🎊 Cloudflare D1 导入任务完成！'))
  } catch (error) {
    console.error(chalk.red('❌ D1 导入任务失败:'), error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { CloudflareD1Importer }
```

### 步骤3：数据同步验证工具

```typescript
// src/sync-verify.ts
import Database from 'better-sqlite3'
import { MongoClient } from 'mongodb'
import { readFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config()

interface SyncResult {
  isConsistent: boolean
  differences: {
    table: string
    mongoCount: number
    d1Count: number
    difference: number
  }[]
  errors: string[]
}

class SyncValidator {
  private mongoClient: MongoClient
  private d1Database: Database.Database
  private idMapping: Map<string, string>

  constructor(
    private mongoUrl: string,
    private mongoDbName: string,
    private d1Path: string,
  ) {
    this.mongoClient = new MongoClient(mongoUrl)
    this.d1Database = new Database(d1Path)
    this.idMapping = new Map()

    // 加载 ID 映射
    this.loadIdMapping()
  }

  private loadIdMapping(): void {
    try {
      const mappingPath = join(process.cwd(), 'exports', 'id_mapping.json')
      const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'))
      this.idMapping = new Map(Object.entries(mapping))
    } catch (error) {
      console.warn(chalk.orange('⚠️  无法加载 ID 映射文件'))
    }
  }

  async validateSync(): Promise<SyncResult> {
    console.log(chalk.blue('🔍 开始验证数据同步一致性...'))

    const result: SyncResult = {
      isConsistent: true,
      differences: [],
      errors: [],
    }

    try {
      await this.mongoClient.connect()
      const mongoDb = this.mongoClient.db(this.mongoDbName)

      // 验证各表数据一致性
      const collections = [
        { mongo: 'users', d1: 'users' },
        { mongo: 'articles', d1: 'articles' },
        { mongo: 'comments', d1: 'comments' },
      ]

      for (const { mongo, d1 } of collections) {
        const mongoCount = await mongoDb.collection(mongo).countDocuments()
        const d1Count = this.d1Database
          .prepare(`SELECT COUNT(*) as count FROM ${d1}`)
          .get().count

        const difference = Math.abs(mongoCount - d1Count)

        result.differences.push({
          table: d1,
          mongoCount,
          d1Count,
          difference,
        })

        if (difference > 0) {
          result.isConsistent = false
        }

        console.log(
          chalk.white(
            `${d1}: MongoDB(${mongoCount}) vs D1(${d1Count}) 差异: ${difference}`,
          ),
        )
      }

      // 验证关键数据的内容一致性
      await this.validateSampleData(mongoDb, result)

      if (result.isConsistent) {
        console.log(chalk.green('✓ 数据同步一致性验证通过'))
      } else {
        console.log(chalk.red('❌ 发现数据不一致'))
      }

      return result
    } catch (error) {
      result.errors.push(error.message)
      console.error(chalk.red('❌ 同步验证失败:'), error)
      return result
    } finally {
      await this.mongoClient.close()
      this.d1Database.close()
    }
  }

  private async validateSampleData(
    mongoDb: any,
    result: SyncResult,
  ): Promise<void> {
    console.log(chalk.yellow('🔍 验证样本数据内容一致性...'))

    try {
      // 验证用户数据样本
      const mongoUsers = await mongoDb
        .collection('users')
        .find({})
        .limit(10)
        .toArray()

      for (const mongoUser of mongoUsers) {
        const d1UserId = this.idMapping.get(mongoUser._id.toString())
        if (!d1UserId) continue

        const d1User = this.d1Database
          .prepare('SELECT * FROM users WHERE id = ?')
          .get(d1UserId)

        if (!d1User) {
          result.errors.push(`用户 ${mongoUser.username} 在 D1 中不存在`)
          continue
        }

        // 验证关键字段
        if (mongoUser.username !== d1User.username) {
          result.errors.push(`用户 ${mongoUser.username} 的用户名不匹配`)
        }

        if (mongoUser.phone !== d1User.phone) {
          result.errors.push(`用户 ${mongoUser.username} 的手机号不匹配`)
        }
      }

      console.log(
        chalk.green(`✓ 样本数据验证完成，发现 ${result.errors.length} 个问题`),
      )
    } catch (error) {
      result.errors.push(`样本数据验证失败: ${error.message}`)
    }
  }
}

// 主执行函数
async function main() {
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'
    const mongoDbName = process.env.MONGO_DB_NAME || 'vue_blog'
    const d1Path = process.env.D1_LOCAL_PATH || './local.db'

    const validator = new SyncValidator(mongoUrl, mongoDbName, d1Path)
    const result = await validator.validateSync()

    console.log(chalk.blue('\\n📊 验证结果摘要:'))
    result.differences.forEach(diff => {
      const status = diff.difference === 0 ? '✓' : '❌'
      console.log(
        chalk.white(`${status} ${diff.table}: ${diff.difference} 条差异`),
      )
    })

    if (result.errors.length > 0) {
      console.log(chalk.red('\\n错误详情:'))
      result.errors.forEach(error => console.log(chalk.red(`  - ${error}`)))
    }

    process.exit(result.isConsistent ? 0 : 1)
  } catch (error) {
    console.error(chalk.red('❌ 同步验证任务失败:'), error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { SyncValidator }
```

### 步骤4：更新 package.json 脚本

```json
{
  "scripts": {
    "export": "ts-node src/export.ts",
    "import": "ts-node src/import.ts",
    "import:d1": "ts-node src/import-to-d1.ts",
    "verify": "ts-node src/verify.ts",
    "sync:verify": "ts-node src/sync-verify.ts",
    "migrate": "npm run export && npm run import && npm run verify",
    "migrate:full": "npm run export && npm run import && npm run import:d1 && npm run sync:verify"
  }
}
```

## 🔍 深入思考

### D1 性能优化策略

#### 批量插入优化

```typescript
// 优化的批量插入策略
class OptimizedBatchImporter {
  private async importWithTransaction(
    data: any[],
    table: string,
    batchSize: number = 500,
  ): Promise<void> {
    const batches = this.createBatches(data, batchSize)

    for (const batch of batches) {
      // 使用事务确保批次完整性
      const transaction = this.db.transaction(() => {
        const stmt = this.db.prepare(this.getInsertSQL(table))

        for (const record of batch) {
          stmt.run(...this.extractValues(record))
        }
      })

      // 执行事务
      transaction()
    }
  }
}
```

#### 索引创建时机

```sql
-- 策略：先插入数据，后创建索引
-- 1. 数据导入阶段（无索引）
INSERT INTO users VALUES (...);  -- 快速插入

-- 2. 索引创建阶段（数据导入完成后）
CREATE INDEX idx_users_phone ON users(phone);  -- 批量创建索引
```

## ❓ 遇到的问题

### 问题 1：D1 查询大小限制

**问题描述**：Cloudflare D1 单次查询最大 25MB，大批量插入失败  
**解决方案**：

```typescript
// 动态调整批次大小
const estimateQuerySize = (records: any[]): number => {
  const sampleSize = JSON.stringify(records[0]).length
  return records.length * sampleSize * 1.5 // 预留余量
}

const getOptimalBatchSize = (records: any[]): number => {
  const maxSize = 20 * 1024 * 1024 // 20MB 安全阈值
  const estimatedSize = estimateQuerySize([records[0]])
  return Math.floor(maxSize / estimatedSize)
}
```

### 问题 2：并发写入冲突

**问题描述**：多个导入进程同时写入导致锁冲突  
**解决方案**：

```typescript
// 串行化导入流程
const importSequentially = async (tables: string[]) => {
  for (const table of tables) {
    console.log(`导入 ${table}...`)
    await importTable(table)
    console.log(`${table} 导入完成`)

    // 添加短暂延迟，避免连续写入压力
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
```

### 问题 3：外键约束导入顺序

**问题描述**：违反外键约束导致导入失败  
**解决方案**：

```typescript
// 严格按照依赖关系排序
const DEPENDENCY_ORDER = {
  users: [], // 无依赖
  articles: ['users'], // 依赖用户
  article_tags: ['articles'], // 依赖文章
  comments: ['users', 'articles'], // 依赖用户和文章
  praises: ['users', 'articles', 'comments'], // 依赖所有
}

const sortByDependency = (tables: string[]): string[] => {
  return tables.sort((a, b) => {
    const aDeps = DEPENDENCY_ORDER[a]?.length || 0
    const bDeps = DEPENDENCY_ORDER[b]?.length || 0
    return aDeps - bDeps
  })
}
```

## 💡 个人心得

### 今天最大的收获

成功实现了从 JSON 数据到 D1 数据库的完整导入流程，理解了分布式数据库的导入策略和性能优化方法。

### 数据导入的关键经验

1. **批量操作的重要性**：合理的批次大小能显著提升导入性能
2. **事务的必要性**：确保数据一致性，避免部分失败状态
3. **依赖关系管理**：严格按照外键依赖顺序导入数据
4. **错误处理策略**：容错设计和详细的日志记录

## 📋 行动清单

### 今日完成

- [x] 实现本地 SQLite 数据导入功能
- [x] 创建 Cloudflare D1 远程导入工具
- [x] 建立数据同步验证机制
- [x] 优化批量导入性能和错误处理

### 明日预习

- [ ] 了解前端构建优化技术
- [ ] 思考生产环境配置管理
- [ ] 准备性能监控和错误追踪

## 🔗 有用链接

- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [SQLite 性能优化](https://www.sqlite.org/optoverview.html)
- [批量数据导入最佳实践](https://sqlite.org/lang_insert.html)

---

**📝 明日重点**：优化前端构建配置，实现生产环境的性能优化和错误监控。
