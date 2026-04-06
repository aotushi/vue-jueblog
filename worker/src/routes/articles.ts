import { Hono } from 'hono'
import type { AppEnv } from '../types'
const articles = new Hono<AppEnv>()
export default articles
