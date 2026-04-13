import { createMiddleware } from 'hono/factory'
import { verifyJwt } from '../utils/jwt'
import { unauthorized } from '../utils/response'
import type { AppEnv } from '../types'

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return unauthorized()

  const token = authHeader.slice(7)
  try {
    const payload = await verifyJwt(token)
    c.set('userId', payload.id)
    await next()
  } catch {
    return unauthorized()
  }
})

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyJwt(authHeader.slice(7))
      c.set('userId', payload.id)
    } catch {
      /* ignore invalid token */
    }
  }
  await next()
})
