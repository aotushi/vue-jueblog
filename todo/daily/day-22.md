# Day 22: 数据导出脚本开发

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 创建 `migration-tools/export-mongo.js`
- [ ] 实现 MongoDB 数据导出功能
- [ ] 处理数据格式转换（ObjectId → string）
- [ ] 生成 JSON 格式的中间数据文件

## 📚 学习笔记

### 数据迁移架构设计

#### 迁移流程概览

```
MongoDB → 导出脚本 → JSON 中间文件 → 导入脚本 → Cloudflare D1
   ↓           ↓              ↓           ↓              ↓
原始数据 → 格式转换 → 标准化数据 → 类型映射 → 边缘数据库
```

#### 数据转换策略

1. **ID 转换**: ObjectId → UUID
2. **日期转换**: MongoDB Date → ISO 8601 字符串
3. **数组处理**: MongoDB 数组 → 关联表记录
4. **引用关系**: 保留映射关系，确保数据完整性

### MongoDB 数据导出实现

```javascript
// migration-tools/export-mongo.js
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// MongoDB 连接配置
const MONGO_URI = 'mongodb://localhost:27017/juejin_blog'

// 导入现有模型
const User = require('../server/module/users')
const Article = require('../server/module/articles')
const Comment = require('../server/module/comments')
const Praise = require('../server/module/praises')
const Follow = require('../server/module/follows')
const Message = require('../server/module/messages')
const ShortMsg = require('../server/module/shortmsg')

// ID 映射表，用于维护关系
const idMappings = {
  users: new Map(),
  articles: new Map(),
  comments: new Map(),
  shortmsgs: new Map(),
}

class MongoExporter {
  constructor() {
    this.exportData = {
      users: [],
      articles: [],
      article_tags: [],
      comments: [],
      praises: [],
      follows: [],
      messages: [],
      shortmsgs: [],
      metadata: {
        exportTime: new Date().toISOString(),
        totalRecords: 0,
        collections: {},
      },
    }
  }

  async connect() {
    try {
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      console.log('✅ MongoDB 连接成功')
    } catch (error) {
      console.error('❌ MongoDB 连接失败:', error)
      process.exit(1)
    }
  }

  async disconnect() {
    await mongoose.disconnect()
    console.log('✅ MongoDB 连接已关闭')
  }

  // 生成新的 UUID 并维护映射关系
  generateNewId(collection, oldId) {
    const oldIdStr = oldId.toString()
    if (!idMappings[collection].has(oldIdStr)) {
      idMappings[collection].set(oldIdStr, uuidv4())
    }
    return idMappings[collection].get(oldIdStr)
  }

  // 查找映射后的 ID
  getMappedId(collection, oldId) {
    return idMappings[collection].get(oldId.toString()) || null
  }

  // 导出用户数据
  async exportUsers() {
    console.log('📤 导出用户数据...')

    const users = await User.find({}).lean()
    console.log(`   发现 ${users.length} 个用户`)

    for (const user of users) {
      const newId = this.generateNewId('users', user._id)

      this.exportData.users.push({
        id: newId,
        old_id: user._id.toString(),
        phone: user.phone,
        username: user.username,
        password: user.password,
        avatar: user.avatar || '',
        introduc: user.introduc || '',
        position: user.position || '',
        company: user.company || '',
        jue_power: user.jue_power || 0,
        good_num: user.good_num || 0,
        read_num: user.read_num || 0,
        created_at: user.createdAt
          ? user.createdAt.toISOString()
          : new Date().toISOString(),
        updated_at: user.updatedAt
          ? user.updatedAt.toISOString()
          : new Date().toISOString(),
      })
    }

    this.exportData.metadata.collections.users = users.length
    console.log(`✅ 用户数据导出完成: ${users.length} 条`)
  }

  // 导出文章数据
  async exportArticles() {
    console.log('📤 导出文章数据...')

    const articles = await Article.find({}).lean()
    console.log(`   发现 ${articles.length} 篇文章`)

    for (const article of articles) {
      const newId = this.generateNewId('articles', article._id)
      const authorId = this.getMappedId('users', article.author_id)

      if (!authorId) {
        console.warn(`⚠️  文章 ${article.title} 的作者ID无效，跳过`)
        continue
      }

      // 导出文章基本信息
      this.exportData.articles.push({
        id: newId,
        old_id: article._id.toString(),
        title: article.title,
        content: article.content || '',
        summary: this.generateSummary(article.content || ''),
        author_id: authorId,
        status: article.status || 'draft',
        view_count: article.view_count || 0,
        like_count: article.like_count || 0,
        comment_count: article.comment_count || 0,
        created_at: article.created_at
          ? article.created_at.toISOString()
          : new Date().toISOString(),
        updated_at: article.updated_at
          ? article.updated_at.toISOString()
          : new Date().toISOString(),
        published_at: article.published_at
          ? article.published_at.toISOString()
          : null,
      })

      // 处理文章标签（数组 → 关联表）
      if (article.tags && Array.isArray(article.tags)) {
        for (const tag of article.tags) {
          this.exportData.article_tags.push({
            id: uuidv4(),
            article_id: newId,
            tag: tag.trim(),
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    this.exportData.metadata.collections.articles = articles.length
    this.exportData.metadata.collections.article_tags =
      this.exportData.article_tags.length
    console.log(`✅ 文章数据导出完成: ${articles.length} 条`)
    console.log(
      `✅ 文章标签导出完成: ${this.exportData.article_tags.length} 条`,
    )
  }

  // 导出评论数据
  async exportComments() {
    console.log('📤 导出评论数据...')

    const comments = await Comment.find({}).lean()
    console.log(`   发现 ${comments.length} 条评论`)

    for (const comment of comments) {
      const newId = this.generateNewId('comments', comment._id)
      const authorId = this.getMappedId('users', comment.author_id)

      if (!authorId) {
        console.warn(`⚠️  评论作者ID无效，跳过`)
        continue
      }

      // 处理评论来源ID的映射
      let sourceId = null
      if (comment.source_type === 'article') {
        sourceId = this.getMappedId('articles', comment.source_id)
      } else if (comment.source_type === 'shortmsg') {
        sourceId = this.getMappedId('shortmsgs', comment.source_id)
      }

      if (!sourceId) {
        console.warn(`⚠️  评论来源ID无效，跳过`)
        continue
      }

      // 处理父评论ID
      let parentId = null
      if (comment.parent_id) {
        parentId = this.getMappedId('comments', comment.parent_id)
      }

      this.exportData.comments.push({
        id: newId,
        old_id: comment._id.toString(),
        content: comment.content,
        author_id: authorId,
        source_id: sourceId,
        source_type: comment.source_type,
        parent_id: parentId,
        created_at: comment.created_at
          ? comment.created_at.toISOString()
          : new Date().toISOString(),
      })
    }

    this.exportData.metadata.collections.comments = comments.length
    console.log(`✅ 评论数据导出完成: ${comments.length} 条`)
  }

  // 导出点赞数据
  async exportPraises() {
    console.log('📤 导出点赞数据...')

    const praises = await Praise.find({}).lean()
    console.log(`   发现 ${praises.length} 条点赞`)

    for (const praise of praises) {
      const userId = this.getMappedId('users', praise.user_id)
      if (!userId) continue

      let sourceId = null
      if (praise.source_type === 'article') {
        sourceId = this.getMappedId('articles', praise.source_id)
      } else if (praise.source_type === 'shortmsg') {
        sourceId = this.getMappedId('shortmsgs', praise.source_id)
      } else if (praise.source_type === 'comment') {
        sourceId = this.getMappedId('comments', praise.source_id)
      }

      if (!sourceId) continue

      this.exportData.praises.push({
        id: uuidv4(),
        user_id: userId,
        source_id: sourceId,
        source_type: praise.source_type,
        created_at: praise.created_at
          ? praise.created_at.toISOString()
          : new Date().toISOString(),
      })
    }

    this.exportData.metadata.collections.praises =
      this.exportData.praises.length
    console.log(`✅ 点赞数据导出完成: ${this.exportData.praises.length} 条`)
  }

  // 导出关注数据
  async exportFollows() {
    console.log('📤 导出关注数据...')

    const follows = await Follow.find({}).lean()
    console.log(`   发现 ${follows.length} 条关注关系`)

    for (const follow of follows) {
      const userId = this.getMappedId('users', follow.user_id)
      const fansId = this.getMappedId('users', follow.fans_id)

      if (!userId || !fansId) continue

      this.exportData.follows.push({
        id: uuidv4(),
        user_id: userId,
        fans_id: fansId,
        created_at: follow.created_at
          ? follow.created_at.toISOString()
          : new Date().toISOString(),
      })
    }

    this.exportData.metadata.collections.follows =
      this.exportData.follows.length
    console.log(`✅ 关注数据导出完成: ${this.exportData.follows.length} 条`)
  }

  // 生成摘要
  generateSummary(content, maxLength = 200) {
    if (!content) return ''

    // 移除 Markdown 标记
    const plainText = content
      .replace(/[#*`_~]/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + '...'
      : plainText
  }

  // 保存导出数据
  async saveExportData() {
    const outputDir = path.join(__dirname, 'output')
    const outputFile = path.join(outputDir, `mongodb-export-${Date.now()}.json`)

    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 计算总记录数
    this.exportData.metadata.totalRecords = Object.values(this.exportData)
      .filter(item => Array.isArray(item))
      .reduce((total, arr) => total + arr.length, 0)

    // 保存数据
    fs.writeFileSync(outputFile, JSON.stringify(this.exportData, null, 2))

    // 保存ID映射表（用于调试）
    const mappingFile = path.join(outputDir, `id-mappings-${Date.now()}.json`)
    const mappingData = {}
    for (const [collection, map] of Object.entries(idMappings)) {
      mappingData[collection] = Object.fromEntries(map)
    }
    fs.writeFileSync(mappingFile, JSON.stringify(mappingData, null, 2))

    console.log(`\n📁 导出文件保存至: ${outputFile}`)
    console.log(`📁 ID映射文件: ${mappingFile}`)
    console.log(`\n📊 导出统计:`)
    console.table(this.exportData.metadata.collections)
    console.log(`📈 总记录数: ${this.exportData.metadata.totalRecords}`)
  }

  // 执行完整导出流程
  async exportAll() {
    try {
      console.log('🚀 开始数据导出...\n')

      await this.connect()

      // 按依赖顺序导出
      await this.exportUsers()
      await this.exportArticles()
      await this.exportComments()
      await this.exportPraises()
      await this.exportFollows()

      await this.saveExportData()

      await this.disconnect()

      console.log('\n🎉 数据导出完成!')
    } catch (error) {
      console.error('❌ 数据导出失败:', error)
      process.exit(1)
    }
  }
}

// 运行导出
if (require.main === module) {
  const exporter = new MongoExporter()
  exporter.exportAll()
}

module.exports = MongoExporter
```

## 🛠️ 实践操作

### 步骤1：创建迁移工具目录

```bash
# 在项目根目录创建迁移工具目录
mkdir -p migration-tools/output

# 安装依赖
cd migration-tools
npm init -y
npm install uuid
```

### 步骤2：配置 package.json 脚本

```json
{
  "name": "vue-blog-migration-tools",
  "version": "1.0.0",
  "scripts": {
    "export": "node export-mongo.js",
    "import": "node import-d1.js",
    "verify": "node verify-data.js",
    "full-migration": "npm run export && npm run import && npm run verify"
  },
  "dependencies": {
    "uuid": "^9.0.0"
  }
}
```

### 步骤3：测试数据导出

```bash
# 确保 MongoDB 服务运行
mongod

# 执行导出
npm run export

# 检查输出文件
ls -la output/
```

**执行结果记录**：

```
导出记录统计：
- 用户: _____ 条
- 文章: _____ 条
- 评论: _____ 条
- 点赞: _____ 条
- 关注: _____ 条

导出文件大小: _____ MB
遇到的问题: _____
```

### 步骤4：数据验证脚本

```javascript
// migration-tools/validate-export.js
const fs = require('fs')

function validateExportData(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const issues = []

  // 检查必要字段
  const requiredCollections = ['users', 'articles', 'comments', 'praises']
  for (const collection of requiredCollections) {
    if (!Array.isArray(data[collection])) {
      issues.push(`缺少集合: ${collection}`)
    }
  }

  // 检查用户数据完整性
  for (const user of data.users) {
    if (!user.id || !user.phone || !user.username) {
      issues.push(`用户数据不完整: ${user.id}`)
    }
  }

  // 检查外键引用完整性
  const userIds = new Set(data.users.map(u => u.id))
  for (const article of data.articles) {
    if (!userIds.has(article.author_id)) {
      issues.push(`文章 ${article.id} 引用了不存在的用户 ${article.author_id}`)
    }
  }

  return issues
}

// 运行验证
const exportFile = process.argv[2]
if (!exportFile) {
  console.error('请提供导出文件路径')
  process.exit(1)
}

const issues = validateExportData(exportFile)
if (issues.length === 0) {
  console.log('✅ 数据验证通过')
} else {
  console.log('❌ 发现数据问题:')
  issues.forEach(issue => console.log(`  - ${issue}`))
}
```

## 🔍 深入思考

### 数据导出的挑战

1. **内存管理**

   - 大量数据可能导致内存溢出
   - 考虑流式处理或分批导出

2. **数据一致性**

   - 导出过程中数据可能被修改
   - 考虑在维护窗口期间导出

3. **关系完整性**
   - 确保外键引用的完整性
   - 处理孤儿记录和循环引用

### 优化策略

```javascript
// 流式导出优化
async function exportUsersStream() {
  const batchSize = 1000
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const users = await User.find({}).skip(skip).limit(batchSize).lean()

    if (users.length === 0) {
      hasMore = false
    } else {
      // 处理当前批次
      this.processBatch(users)
      skip += batchSize
    }
  }
}
```

## ❓ 遇到的问题

### 问题 1：大数据量导出内存不足

**问题描述**：数据量过大时 Node.js 内存溢出  
**解决方案**：

```javascript
// 增加 Node.js 内存限制
process.env.NODE_OPTIONS = '--max-old-space-size=4096'

// 或使用流式处理
const stream = fs.createWriteStream(outputFile)
stream.write('{"users":[')
// 逐条写入数据
```

### 问题 2：ObjectId 转换一致性

**问题描述**：确保同一个 ObjectId 始终映射到同一个 UUID  
**解决方案**：使用全局 ID 映射表，保持转换一致性

## 💡 个人心得

### 今天最大的收获

完成了从 MongoDB 到中间格式的数据导出，深刻理解了数据迁移中关系维护的复杂性。

### 数据迁移的核心原则

1. **完整性优先**：确保数据不丢失
2. **一致性保障**：维护数据关系
3. **可验证性**：提供验证机制
4. **可回滚性**：保留原始数据

## 📋 行动清单

### 今日完成

- [ ] 创建 MongoDB 数据导出脚本
- [ ] 实现 ID 映射和关系维护
- [ ] 添加数据验证机制
- [ ] 测试导出功能

### 明日预习

- [ ] 了解 Cloudflare D1 的批量导入 API
- [ ] 准备 SQL 插入语句生成
- [ ] 思考导入过程的错误处理

## 🔗 有用链接

- [MongoDB Node.js Driver](https://docs.mongodb.com/drivers/node/)
- [UUID 库文档](https://www.npmjs.com/package/uuid)
- [Node.js 流处理](https://nodejs.org/api/stream.html)
- [JSON 大文件处理](https://github.com/dominictarr/JSONStream)

---

**📝 明日重点**：开发 D1 数据导入脚本，实现 JSON 到 SQL 的数据转换。
