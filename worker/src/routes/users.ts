import { Hono } from 'hono'
import type { AppEnv } from '../types'
const users = new Hono<AppEnv>()
export default users
