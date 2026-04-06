import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, err } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const comments = new Hono<AppEnv>()

// GET / — 获取评论列表（含回复）
comments.get('/', async c => {
  const { source_id, type = 'article' } = c.req.query()
  if (!source_id) return err('source_id 不能为空')
  const db = c.env.DB

  const { results } = await db
    .prepare(
      `
    SELECT c.id, c.content, c.parent_id, c.reply_id, c.target_user,
      c.created_at, c.source_id, c.type,
      u.id AS user_id, u.username, u.avatar, u.position
    FROM comments c LEFT JOIN users u ON u.id = c.created_by
    WHERE c.source_id = ? AND c.type = ? AND c.parent_id IS NULL
    ORDER BY c.created_at DESC
  `,
    )
    .bind(Number(source_id), type)
    .all<Record<string, unknown>>()

  const ids = results.map(r => r.id as number)
  let replies: Record<string, unknown>[] = []
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',')
    const res = await db
      .prepare(
        `
      SELECT c.id, c.content, c.parent_id, c.reply_id, c.target_user, c.created_at,
        u.id AS user_id, u.username, u.avatar,
        tu.username AS target_username
      FROM comments c
      LEFT JOIN users u ON u.id = c.created_by
      LEFT JOIN users tu ON tu.id = c.target_user
      WHERE c.parent_id IN (${placeholders})
      ORDER BY c.created_at ASC
    `,
      )
      .bind(...ids)
      .all<Record<string, unknown>>()
    replies = res.results
  }

  const list = results.map(r => ({
    ...r,
    author: {
      id: r.user_id,
      username: r.username,
      avatar: r.avatar,
      position: r.position,
    },
    children: replies
      .filter(rep => rep.parent_id === r.id)
      .map(rep => ({
        ...rep,
        author: { id: rep.user_id, username: rep.username, avatar: rep.avatar },
      })),
  }))
  return ok(list)
})

// POST / — 创建评论（需登录）
comments.post('/', authMiddleware, async c => {
  const {
    source_id,
    type = 'article',
    content,
    parent_id,
    reply_id,
    target_user,
  } = await c.req.json()
  if (!source_id || !content) return err('参数不完整')
  const userId = c.get('userId')
  const db = c.env.DB

  const result = await db
    .prepare(
      'INSERT INTO comments (source_id,type,content,parent_id,reply_id,target_user,created_by) VALUES (?,?,?,?,?,?,?)',
    )
    .bind(
      source_id,
      type,
      content,
      parent_id ?? null,
      reply_id ?? null,
      target_user ?? null,
      userId,
    )
    .run()

  const article = await db
    .prepare('SELECT created_by FROM articles WHERE id=?')
    .bind(source_id)
    .first<{ created_by: number }>()
  if (article && article.created_by !== userId) {
    await db
      .prepare('INSERT INTO messages (user_id,source_id,type) VALUES (?,?,1)')
      .bind(article.created_by, result.meta.last_row_id)
      .run()
  }
  return ok({ id: result.meta.last_row_id })
})

// DELETE /:id — 删除评论（需登录）
comments.delete('/:id', authMiddleware, async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  const db = c.env.DB
  const existing = await db
    .prepare('SELECT created_by FROM comments WHERE id=?')
    .bind(id)
    .first<{ created_by: number }>()
  if (!existing) return err('评论不存在', 404)
  if (existing.created_by !== userId) return err('无权限', 403)
  await db
    .prepare('DELETE FROM comments WHERE id=? OR parent_id=?')
    .bind(id, id)
    .run()
  return ok({ id })
})

export default comments
