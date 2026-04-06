import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, err } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const praises = new Hono<AppEnv>()

// POST /toggle — 点赞/收藏切换（需登录）
praises.post('/toggle', authMiddleware, async c => {
  const { target_id, target_type = 1, type = 1 } = await c.req.json()
  if (!target_id) return err('target_id 不能为空')
  const userId = c.get('userId')
  const db = c.env.DB

  const existing = await db
    .prepare(
      'SELECT id FROM praises WHERE target_id=? AND target_type=? AND type=? AND created_by=?',
    )
    .bind(target_id, target_type, type, userId)
    .first<{ id: number }>()

  if (existing) {
    await db.prepare('DELETE FROM praises WHERE id=?').bind(existing.id).run()
    return ok({ action: 'cancelled' })
  }

  await db
    .prepare(
      'INSERT INTO praises (target_id,target_type,type,created_by) VALUES (?,?,?,?)',
    )
    .bind(target_id, target_type, type, userId)
    .run()

  if (target_type === 1) {
    const article = await db
      .prepare('SELECT created_by FROM articles WHERE id=?')
      .bind(target_id)
      .first<{ created_by: number }>()
    if (article && article.created_by !== userId) {
      await db
        .prepare('INSERT INTO messages (user_id,source_id,type) VALUES (?,?,2)')
        .bind(article.created_by, userId)
        .run()
    }
  }
  return ok({ action: 'praised' })
})

// GET /check — 检查是否已点赞（需登录）
praises.get('/check', authMiddleware, async c => {
  const { target_id, type = '1', target_type = '1' } = c.req.query()
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(
    'SELECT id FROM praises WHERE target_id=? AND target_type=? AND type=? AND created_by=?',
  )
    .bind(Number(target_id), Number(target_type), Number(type), userId)
    .first()
  return ok({ praised: !!result })
})

export default praises
