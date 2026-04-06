import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const messages = new Hono<AppEnv>()

// GET / — 未读消息数量汇总（需登录）
messages.get('/', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const row = await db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN type=1 THEN 1 ELSE 0 END) AS comment_num,
      SUM(CASE WHEN type=2 THEN 1 ELSE 0 END) AS praise_num,
      SUM(CASE WHEN type=3 THEN 1 ELSE 0 END) AS follow_num
    FROM messages WHERE user_id=? AND status=0
  `,
    )
    .bind(userId)
    .first<{ comment_num: number; praise_num: number; follow_num: number }>()
  return ok(row ?? { comment_num: 0, praise_num: 0, follow_num: 0 })
})

// GET /comments — 评论消息列表（需登录）
messages.get('/comments', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const { results } = await db
    .prepare(
      `
    SELECT m.*, c.content AS comment_content,
      u.username AS from_username, u.avatar AS from_avatar
    FROM messages m
    LEFT JOIN comments c ON c.id = m.source_id
    LEFT JOIN users u ON u.id = c.created_by
    WHERE m.user_id=? AND m.type=1
    ORDER BY m.created_at DESC LIMIT 20
  `,
    )
    .bind(userId)
    .all()
  await db
    .prepare('UPDATE messages SET status=1 WHERE user_id=? AND type=1')
    .bind(userId)
    .run()
  return ok(results)
})

// GET /praises — 点赞消息列表（需登录）
messages.get('/praises', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const { results } = await db
    .prepare(
      `
    SELECT m.*, u.username AS from_username, u.avatar AS from_avatar
    FROM messages m
    LEFT JOIN users u ON u.id = m.source_id
    WHERE m.user_id=? AND m.type=2
    ORDER BY m.created_at DESC LIMIT 20
  `,
    )
    .bind(userId)
    .all()
  await db
    .prepare('UPDATE messages SET status=1 WHERE user_id=? AND type=2')
    .bind(userId)
    .run()
  return ok(results)
})

// GET /follows — 关注消息列表（需登录）
messages.get('/follows', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const { results } = await db
    .prepare(
      `
    SELECT m.*, u.username AS from_username, u.avatar AS from_avatar, u.introduc AS from_introduc
    FROM messages m LEFT JOIN users u ON u.id = m.source_id
    WHERE m.user_id=? AND m.type=3
    ORDER BY m.created_at DESC LIMIT 20
  `,
    )
    .bind(userId)
    .all()
  await db
    .prepare('UPDATE messages SET status=1 WHERE user_id=? AND type=3')
    .bind(userId)
    .run()
  return ok(results)
})

export default messages
