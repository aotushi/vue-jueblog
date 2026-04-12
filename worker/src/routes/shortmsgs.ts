import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, err } from '../utils/response'
import { authMiddleware, optionalAuth } from '../middleware/auth'

const shortmsgs = new Hono<AppEnv>()

// GET /groups — 圈子分类（静态数据）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
shortmsgs.get('/groups', _c => {
  return ok([
    { key: 'all', label: '综合', icon: 'orange' },
    {
      key: 'circles',
      label: '圈子',
      children: [
        { key: 'daily', label: '打工日常' },
        { key: 'techno', label: '技术圈' },
        { key: 'blind_date', label: '相亲角' },
        { key: 'slack_off', label: '上班摸鱼' },
        { key: 'eating', label: '中午吃啥' },
        { key: 'playing', label: '下班去哪玩' },
        { key: 'bigtea', label: '在线吃瓜' },
      ],
    },
  ])
})

// GET /lists — 沸点列表（可选认证，登录后返回 is_praise）
shortmsgs.get('/lists', optionalAuth, async c => {
  const { group = 'all', page = '1', created_by = '' } = c.req.query()
  const limit = 20
  const offset = (Number(page) - 1) * limit
  const db = c.env.DB
  const userId = c.get('userId') ?? null
  const isAll = !group || group === 'all'
  const hasAuthor = !!created_by

  const conditions: string[] = ['1=1']
  if (!isAll) conditions.push('s.group_key = ?')
  if (hasAuthor) conditions.push('s.created_by = ?')
  const where = conditions.join(' AND ')

  const binds: unknown[] = []
  if (!isAll) binds.push(group)
  if (hasAuthor) binds.push(Number(created_by))

  const { results } = await db
    .prepare(
      `SELECT s.id, s.content, s.images, s.group_key, s.created_at, s.created_by,
        u.id AS user_id, u.username, u.avatar, u.position,
        COUNT(DISTINCT p.id) AS praise_num,
        COUNT(DISTINCT cm.id) AS comment_num
      FROM shortmsgs s
      LEFT JOIN users u ON u.id = s.created_by
      LEFT JOIN praises p ON p.target_id = s.id AND p.target_type=2 AND p.type=1
      LEFT JOIN comments cm ON cm.source_id = s.id AND cm.type = 'shortmsg'
      WHERE ${where}
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<Record<string, unknown>>()

  let praisedSet = new Set<number>()
  if (userId && results.length > 0) {
    const ids = results.map(r => r.id as number)
    const placeholders = ids.map(() => '?').join(',')
    const { results: praised } = await db
      .prepare(
        `SELECT target_id FROM praises WHERE target_id IN (${placeholders}) AND target_type=2 AND type=1 AND created_by=?`,
      )
      .bind(...ids, userId)
      .all<{ target_id: number }>()
    praisedSet = new Set(praised.map(p => p.target_id))
  }

  const list = results.map(r => ({
    ...r,
    images: JSON.parse(r.images as string),
    is_praise: praisedSet.has(r.id as number),
    author: {
      id: r.user_id,
      username: r.username,
      avatar: r.avatar,
      position: r.position,
    },
  }))

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM shortmsgs s WHERE ${where}`)
    .bind(...binds)
    .first<{ total: number }>()

  return ok({
    meta: { page: Number(page), per_page: limit, total: countRow?.total ?? 0 },
    data: list,
  })
})

// POST /create — 发布沸点（需登录）
shortmsgs.post('/create', authMiddleware, async c => {
  const { content, images = [], group_key = 'all' } = await c.req.json()
  if (!content) return err('内容不能为空')
  const userId = c.get('userId')
  const result = await c.env.DB.prepare(
    'INSERT INTO shortmsgs (content,images,created_by,group_key) VALUES (?,?,?,?)',
  )
    .bind(content, JSON.stringify(images), userId, group_key)
    .run()
  return ok({ id: result.meta.last_row_id })
})

// DELETE /remove/:id — 删除沸点（需登录）
shortmsgs.delete('/remove/:id', authMiddleware, async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  const db = c.env.DB
  const existing = await db
    .prepare('SELECT created_by FROM shortmsgs WHERE id=?')
    .bind(id)
    .first<{ created_by: number }>()
  if (!existing) return err('沸点不存在', 404)
  if (existing.created_by !== userId) return err('无权限', 403)
  await db.prepare('DELETE FROM shortmsgs WHERE id=?').bind(id).run()
  return ok({ id })
})

export default shortmsgs
