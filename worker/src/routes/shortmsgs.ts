import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { ok, err } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const shortmsgs = new Hono<AppEnv>()

// GET /groups — 圈子分类（静态数据）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
shortmsgs.get('/groups', _c => {
  return ok([
    { key: 'all', label: '综合', icon: 'orange' },
    { key: 'daily', label: '打工日常' },
    { key: 'techno', label: '技术圈' },
    { key: 'blind_date', label: '相亲角' },
    { key: 'slack_off', label: '上班摸鱼' },
    { key: 'eating', label: '中午吃啥' },
    { key: 'playing', label: '下班去哪玩' },
    { key: 'bigtea', label: '在线吃瓜' },
  ])
})

// GET / — 获取沸点列表
shortmsgs.get('/', async c => {
  const { group = 'all', page = '1' } = c.req.query()
  const limit = 20
  const offset = (Number(page) - 1) * limit
  const db = c.env.DB
  const isAll = group === 'all'

  const { results } = await db
    .prepare(
      `
    SELECT s.id, s.content, s.images, s.group_key, s.created_at,
      u.id AS user_id, u.username, u.avatar, u.position,
      COUNT(DISTINCT p.id) AS praise_num
    FROM shortmsgs s
    LEFT JOIN users u ON u.id = s.created_by
    LEFT JOIN praises p ON p.target_id = s.id AND p.target_type=2 AND p.type=1
    WHERE 1=1 ${isAll ? '' : 'AND s.group_key = ?'}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `,
    )
    .bind(...(isAll ? [limit, offset] : [group, limit, offset]))
    .all<Record<string, unknown>>()

  const list = results.map(r => ({
    ...r,
    images: JSON.parse(r.images as string),
    author: {
      id: r.user_id,
      username: r.username,
      avatar: r.avatar,
      position: r.position,
    },
  }))
  return ok(list)
})

// POST / — 发布沸点（需登录）
shortmsgs.post('/', authMiddleware, async c => {
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

// DELETE /:id — 删除沸点（需登录）
shortmsgs.delete('/:id', authMiddleware, async c => {
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
