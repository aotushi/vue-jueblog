import { Hono } from 'hono'
import type { AppEnv } from '../types'
const praises = new Hono<AppEnv>()
export default praises
