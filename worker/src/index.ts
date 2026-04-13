import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import usersRoutes from './routes/users'
import articlesRoutes from './routes/articles'
import commentsRoutes from './routes/comments'
import praisesRoutes from './routes/praises'
import followsRoutes from './routes/follows'
import messagesRoutes from './routes/messages'
import shortmsgsRoutes from './routes/shortmsgs'

const app = new Hono<AppEnv>()

app.use('*', cors())

app.route('/api2/users', usersRoutes)
app.route('/api2/articles', articlesRoutes)
app.route('/api2/comments', commentsRoutes)
app.route('/api2/praises', praisesRoutes)
app.route('/api2/follows', followsRoutes)
app.route('/api2/messages', messagesRoutes)
app.route('/api2/stmsgs', shortmsgsRoutes)

app.notFound(c => c.json({ code: 404, message: '接口不存在' }, 404))
app.onError((err, c) => c.json({ code: 500, message: err.message }, 500))

export default app
