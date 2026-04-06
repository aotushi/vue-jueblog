import { Hono } from 'hono'
import type { AppEnv } from '../types'
const messages = new Hono<AppEnv>()
export default messages
