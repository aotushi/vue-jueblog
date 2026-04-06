import { Hono } from 'hono'
import type { AppEnv } from '../types'
const follows = new Hono<AppEnv>()
export default follows
