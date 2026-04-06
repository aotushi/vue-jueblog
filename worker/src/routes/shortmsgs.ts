import { Hono } from 'hono'
import type { AppEnv } from '../types'
const shortmsgs = new Hono<AppEnv>()
export default shortmsgs
