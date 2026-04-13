import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, err } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const follows = new Hono<AppEnv>()

// POST /toggle — 关注/取消关注（需登录）
follows.post('/toggle', authMiddleware, async c => {
  const { user_id } = await c.req.json()
  if (!user_id) return err('user_id 不能为空')
  const fansId = c.get('userId')
  const db = c.env.DB

  const existing = await db
    .prepare('SELECT id FROM follows WHERE user_id=? AND fans_id=?')
    .bind(user_id, fansId)
    .first<{ id: number }>()

  if (existing) {
    await db.prepare('DELETE FROM follows WHERE id=?').bind(existing.id).run()
    return ok({ action: 'unfollowed' })
  }

  await db
    .prepare('INSERT INTO follows (user_id,fans_id) VALUES (?,?)')
    .bind(user_id, fansId)
    .run()
  if (user_id !== fansId) {
    await db
      .prepare('INSERT INTO messages (user_id,source_id,type) VALUES (?,?,3)')
      .bind(user_id, fansId)
      .run()
  }
  return ok({ action: 'followed' })
})

// GET /check — 检查是否已关注（需登录）
follows.get('/check', authMiddleware, async c => {
  const { user_id } = c.req.query()
  const fansId = c.get('userId')
  const result = await c.env.DB.prepare(
    'SELECT id FROM follows WHERE user_id=? AND fans_id=?',
  )
    .bind(Number(user_id), fansId)
    .first()
  return ok({ followed: !!result })
})

// GET / — 关注/粉丝列表
follows.get('/', async c => {
  const { user_id, type = 'following' } = c.req.query()
  if (!user_id) return err('user_id 不能为空')
  const db = c.env.DB

  if (type === 'following') {
    const { results } = await db
      .prepare(
        `
      SELECT u.id, u.username, u.avatar, u.position, u.introduc
      FROM follows f LEFT JOIN users u ON u.id = f.user_id
      WHERE f.fans_id = ? ORDER BY f.created_at DESC
    `,
      )
      .bind(Number(user_id))
      .all()
    return ok(results)
  } else {
    const { results } = await db
      .prepare(
        `
      SELECT u.id, u.username, u.avatar, u.position, u.introduc
      FROM follows f LEFT JOIN users u ON u.id = f.fans_id
      WHERE f.user_id = ? ORDER BY f.created_at DESC
    `,
      )
      .bind(Number(user_id))
      .all()
    return ok(results)
  }
})

// POST /is-follow — 检查是否已关注（前端调用路径，需登录）
follows.post('/is-follow', authMiddleware, async c => {
  const { user_id } = await c.req.json()
  const fansId = c.get('userId')
  const result = await c.env.DB.prepare(
    'SELECT id FROM follows WHERE user_id=? AND fans_id=?',
  )
    .bind(Number(user_id), fansId)
    .first()
  return ok({ followed: !!result })
})

// GET /lists — 关注/粉丝列表（前端调用路径）
follows.get('/lists', async c => {
  const { user_id, type = 'following' } = c.req.query()
  if (!user_id) return err('user_id 不能为空')
  const db = c.env.DB

  if (type === 'following') {
    const { results } = await db
      .prepare(
        `SELECT u.id, u.username, u.avatar, u.position, u.introduc
        FROM follows f LEFT JOIN users u ON u.id = f.user_id
        WHERE f.fans_id = ? ORDER BY f.created_at DESC`,
      )
      .bind(Number(user_id))
      .all()
    return ok(results)
  } else {
    const { results } = await db
      .prepare(
        `SELECT u.id, u.username, u.avatar, u.position, u.introduc
        FROM follows f LEFT JOIN users u ON u.id = f.fans_id
        WHERE f.user_id = ? ORDER BY f.created_at DESC`,
      )
      .bind(Number(user_id))
      .all()
    return ok(results)
  }
})

export default follows
