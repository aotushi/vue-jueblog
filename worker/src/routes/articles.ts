import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, err } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const articles = new Hono<AppEnv>()

// GET / — 文章列表
articles.get('/', async c => {
  const { category = 'all', page = '1' } = c.req.query()
  const limit = 10
  const offset = (Number(page) - 1) * limit
  const db = c.env.DB

  const isAll = category === 'all'
  const { results } = await db
    .prepare(
      `
    SELECT
      a.id, a.title, a.intro, a.category, a.tags, a.page_view,
      a.created_at, a.updated_at,
      u.id AS author_id, u.username AS author_name,
      u.avatar AS author_avatar, u.position AS author_position,
      COUNT(DISTINCT p.id) AS praise_num,
      COUNT(DISTINCT cm.id) AS comment_num
    FROM articles a
    LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN praises p ON p.target_id = a.id AND p.target_type = 1 AND p.type = 1
    LEFT JOIN comments cm ON cm.source_id = a.id
    WHERE a.status = 1 ${isAll ? '' : 'AND a.category = ?'}
    GROUP BY a.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `,
    )
    .bind(...(isAll ? [limit, offset] : [category, limit, offset]))
    .all<Record<string, unknown>>()

  const list = results.map(r => ({
    ...r,
    tags: JSON.parse(r.tags as string),
    author: {
      id: r.author_id,
      username: r.author_name,
      avatar: r.author_avatar,
      position: r.author_position,
    },
  }))
  return ok(list)
})

// GET /category — 分类列表（静态数据）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
articles.get('/category', _c => {
  return ok([
    { key: 'all', label: '综合', icon: 'compass' },
    { key: 'frontend', label: '前端', icon: 'baseball' },
    { key: 'backend', label: '后端', icon: 'football' },
    { key: 'android', label: '安卓', icon: 'hot-water' },
    { key: 'ios', label: 'IOS', icon: 'apple' },
    { key: 'ai', label: 'AI', icon: 'cpu' },
    { key: 'tool', label: '开发工具', icon: 'mouse' },
    { key: 'life', label: '代码人生', icon: 'clock' },
  ])
})

// GET /:id — 文章详情
articles.get('/:id', async c => {
  const id = Number(c.req.param('id'))
  const db = c.env.DB

  await db
    .prepare('UPDATE articles SET page_view = page_view + 1 WHERE id = ?')
    .bind(id)
    .run()

  const article = await db
    .prepare(
      `
    SELECT a.*, u.id AS author_id, u.username AS author_name,
      u.avatar AS author_avatar, u.position AS author_position,
      u.introduc AS author_introduc, u.company AS author_company
    FROM articles a LEFT JOIN users u ON u.id = a.created_by
    WHERE a.id = ?
  `,
    )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!article) return err('文章不存在', 404)
  return ok({
    ...article,
    tags: JSON.parse(article.tags as string),
    author: {
      id: article.author_id,
      username: article.author_name,
      avatar: article.author_avatar,
      position: article.author_position,
      introduc: article.author_introduc,
      company: article.author_company,
    },
  })
})

// POST / — 创建文章（需登录）
articles.post('/', authMiddleware, async c => {
  const { title, intro = '', content, category, tags = [] } = await c.req.json()
  if (!title || !content) return err('标题和内容不能为空')
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(
    'INSERT INTO articles (title,intro,content,category,tags,created_by) VALUES (?,?,?,?,?,?)',
  )
    .bind(title, intro, content, category, JSON.stringify(tags), userId)
    .run()
  return ok({ id: result.meta.last_row_id })
})

// PUT /:id — 更新文章（需登录）
articles.put('/:id', authMiddleware, async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  const db = c.env.DB
  const existing = await db
    .prepare('SELECT created_by FROM articles WHERE id=?')
    .bind(id)
    .first<{ created_by: number }>()
  if (!existing) return err('文章不存在', 404)
  if (existing.created_by !== userId) return err('无权限', 403)

  const { title, intro, content, category, tags } = await c.req.json()
  await db
    .prepare(
      'UPDATE articles SET title=?,intro=?,content=?,category=?,tags=?,updated_at=datetime("now") WHERE id=?',
    )
    .bind(title, intro, content, category, JSON.stringify(tags ?? []), id)
    .run()
  return ok({ id })
})

// PUT /:id/publish — 发布文章（需登录）
articles.put('/:id/publish', authMiddleware, async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  const db = c.env.DB
  const existing = await db
    .prepare('SELECT created_by FROM articles WHERE id=?')
    .bind(id)
    .first<{ created_by: number }>()
  if (!existing) return err('文章不存在', 404)
  if (existing.created_by !== userId) return err('无权限', 403)
  await db
    .prepare(
      'UPDATE articles SET status=1, updated_at=datetime("now") WHERE id=?',
    )
    .bind(id)
    .run()
  return ok({ id })
})

// DELETE /:id — 删除文章（需登录）
articles.delete('/:id', authMiddleware, async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  const db = c.env.DB
  const existing = await db
    .prepare('SELECT created_by FROM articles WHERE id=?')
    .bind(id)
    .first<{ created_by: number }>()
  if (!existing) return err('文章不存在', 404)
  if (existing.created_by !== userId) return err('无权限', 403)
  await db.prepare('DELETE FROM articles WHERE id=?').bind(id).run()
  return ok({ id })
})

export default articles
