import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { encryptPassword } from '../utils/crypto'
import { signJwt } from '../utils/jwt'
import { ok, err } from '../utils/response'
import { authMiddleware } from '../middleware/auth'

const users = new Hono<AppEnv>()

// POST /create — 注册
users.post('/create', async c => {
  const { phone, username, password, introduc } = await c.req.json()
  if (!phone || !username || !password || !introduc) return err('参数不完整')

  const db = c.env.DB
  const exists = await db
    .prepare('SELECT id FROM users WHERE phone = ?')
    .bind(phone)
    .first()
  if (exists) return err('手机号已注册')

  const hashed = await encryptPassword(password)
  const result = await db
    .prepare(
      'INSERT INTO users (phone, username, password, introduc) VALUES (?,?,?,?)',
    )
    .bind(phone, username, hashed, introduc)
    .run()

  const user = await db
    .prepare(
      'SELECT id,phone,username,avatar,introduc,position,company FROM users WHERE id = ?',
    )
    .bind(result.meta.last_row_id)
    .first()
  return ok(user)
})

// POST /login — 登录
users.post('/login', async c => {
  const { phone, password } = await c.req.json()
  if (!phone || !password) return err('参数不完整')

  const db = c.env.DB
  const user = await db
    .prepare('SELECT * FROM users WHERE phone = ?')
    .bind(phone)
    .first<Record<string, unknown>>()
  if (!user) return err('用户不存在')

  const hashed = await encryptPassword(password as string)
  if (user.password !== hashed) return err('密码错误')

  const token = await signJwt({
    id: user.id as number,
    phone: user.phone as string,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safeUser } = user
  return ok({ ...safeUser, token })
})

// GET /:id — 获取用户信息
users.get('/:id', async c => {
  const id = Number(c.req.param('id'))
  const db = c.env.DB
  const user = await db
    .prepare(
      'SELECT id,phone,username,avatar,introduc,position,company,jue_power,good_num,read_num FROM users WHERE id = ?',
    )
    .bind(id)
    .first()
  if (!user) return err('用户不存在', 404)
  return ok(user)
})

// PUT /:id — 更新用户信息（需登录）
users.put('/:id', authMiddleware, async c => {
  const id = Number(c.req.param('id'))
  const userId = c.get('userId')
  if (id !== userId) return err('无权限', 403)

  const { username, avatar, introduc, position, company } = await c.req.json()
  const db = c.env.DB
  await db
    .prepare(
      'UPDATE users SET username=?,avatar=?,introduc=?,position=?,company=? WHERE id=?',
    )
    .bind(username, avatar, introduc, position, company, id)
    .run()
  const user = await db
    .prepare(
      'SELECT id,username,avatar,introduc,position,company FROM users WHERE id=?',
    )
    .bind(id)
    .first()
  return ok(user)
})

// GET / — 用户列表
users.get('/', authMiddleware, async c => {
  const db = c.env.DB
  const { results } = await db
    .prepare(
      'SELECT id,username,avatar,introduc,position,company,jue_power FROM users ORDER BY jue_power DESC LIMIT 20',
    )
    .all()
  return ok(results)
})

export default users
