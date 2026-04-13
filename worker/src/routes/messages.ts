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
      `SELECT
        COALESCE(SUM(CASE WHEN type=1 THEN 1 ELSE 0 END), 0) AS comment,
        COALESCE(SUM(CASE WHEN type=2 THEN 1 ELSE 0 END), 0) AS praise,
        COALESCE(SUM(CASE WHEN type=3 THEN 1 ELSE 0 END), 0) AS follow
      FROM messages WHERE user_id=? AND status=0`,
    )
    .bind(userId)
    .first<{ comment: number; praise: number; follow: number }>()
  const base = row ?? { comment: 0, praise: 0, follow: 0 }
  return ok({ ...base, total: base.comment + base.praise + base.follow })
})

// GET /preview — 未读消息数量汇总（前端调用路径，需登录）
messages.get('/preview', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const row = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type=1 THEN 1 ELSE 0 END), 0) AS comment,
        COALESCE(SUM(CASE WHEN type=2 THEN 1 ELSE 0 END), 0) AS praise,
        COALESCE(SUM(CASE WHEN type=3 THEN 1 ELSE 0 END), 0) AS follow
      FROM messages WHERE user_id=? AND status=0`,
    )
    .bind(userId)
    .first<{ comment: number; praise: number; follow: number }>()
  const base = row ?? { comment: 0, praise: 0, follow: 0 }
  return ok({ ...base, total: base.comment + base.praise + base.follow })
})

// GET /comments — 评论消息列表（需登录）
messages.get('/comments', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const { results } = await db
    .prepare(
      `SELECT m.id, m.created_at,
        c.content, c.parent_id, c.source_id, c.type AS comment_type, c.created_by AS comment_uid,
        u.username AS from_username, u.avatar AS from_avatar,
        a.title AS article_title
      FROM messages m
      LEFT JOIN comments c ON c.id = m.source_id
      LEFT JOIN users u ON u.id = c.created_by
      LEFT JOIN articles a ON a.id = c.source_id AND c.type = 'article'
      WHERE m.user_id=? AND m.type=1
      ORDER BY m.created_at DESC LIMIT 50`,
    )
    .bind(userId)
    .all<Record<string, unknown>>()
  await db
    .prepare('UPDATE messages SET status=1 WHERE user_id=? AND type=1')
    .bind(userId)
    .run()
  const data = results.map(r => ({
    _id: String(r.id),
    content: r.content ?? '',
    created_by: String(r.comment_uid ?? ''),
    type: r.parent_id ? 'reply' : 'source',
    source_type: r.comment_type === 'article' ? 1 : 2,
    source_id: String(r.source_id ?? ''),
    user: { username: r.from_username ?? '', avatar: r.from_avatar ?? '' },
    article: r.article_title ? { title: r.article_title } : null,
    created_at: r.created_at,
  }))
  return ok({ data, meta: { total: data.length, page: 1, per_page: 50 } })
})

// GET /praises — 点赞消息列表（需登录）
messages.get('/praises', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const { results } = await db
    .prepare(
      `SELECT m.id, m.source_id, m.created_at,
        u.username AS from_username, u.avatar AS from_avatar
      FROM messages m
      LEFT JOIN users u ON u.id = m.source_id
      WHERE m.user_id=? AND m.type=2
      ORDER BY m.created_at DESC LIMIT 50`,
    )
    .bind(userId)
    .all<Record<string, unknown>>()
  await db
    .prepare('UPDATE messages SET status=1 WHERE user_id=? AND type=2')
    .bind(userId)
    .run()
  const data = results.map(r => ({
    _id: String(r.id),
    created_by: String(r.source_id ?? ''),
    type: 1,
    target_type: 1,
    target_id: '0',
    user: { username: r.from_username ?? '', avatar: r.from_avatar ?? '' },
    created_at: r.created_at,
  }))
  return ok({ data, meta: { total: data.length, page: 1, per_page: 50 } })
})

// GET /follows — 关注消息列表（需登录）
messages.get('/follows', authMiddleware, async c => {
  const userId = c.get('userId')
  const db = c.env.DB
  const { results } = await db
    .prepare(
      `SELECT m.id, m.source_id, m.created_at,
        u.username AS from_username, u.avatar AS from_avatar, u.introduc AS from_introduc
      FROM messages m
      LEFT JOIN users u ON u.id = m.source_id
      WHERE m.user_id=? AND m.type=3
      ORDER BY m.created_at DESC LIMIT 50`,
    )
    .bind(userId)
    .all<Record<string, unknown>>()
  await db
    .prepare('UPDATE messages SET status=1 WHERE user_id=? AND type=3')
    .bind(userId)
    .run()

  // 批量查询回关状态
  const fanIds = results.map(r => r.source_id as number)
  let followedSet = new Set<number>()
  if (fanIds.length > 0) {
    const placeholders = fanIds.map(() => '?').join(',')
    const followRows = await db
      .prepare(
        `SELECT user_id FROM follows WHERE fans_id=? AND user_id IN (${placeholders})`,
      )
      .bind(userId, ...fanIds)
      .all<{ user_id: number }>()
    followedSet = new Set(followRows.results.map(r => r.user_id))
  }

  const data = results.map(r => ({
    _id: String(r.id),
    user_id: String(userId),
    fans_id: String(r.source_id ?? ''),
    fans_info: {
      username: r.from_username ?? '',
      avatar: r.from_avatar ?? '',
      introduc: r.from_introduc ?? '',
    },
    is_follow: followedSet.has(r.source_id as number),
    created_at: r.created_at,
  }))
  return ok({ data, meta: { total: data.length, page: 1, per_page: 50 } })
})

export default messages
