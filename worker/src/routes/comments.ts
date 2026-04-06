import { Hono } from 'hono'
import type { AppEnv } from '../types'
const comments = new Hono<AppEnv>()
export default comments
