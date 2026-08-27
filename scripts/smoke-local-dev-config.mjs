import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)
const viteConfig = await readFile(
  new URL('../vite.config.ts', import.meta.url),
  'utf8',
)

const workerDev = packageJson.scripts?.['worker:dev'] ?? ''

assert.match(
  workerDev,
  /npm run db:migrate:local/,
  'worker:dev must initialize the local D1 database before starting',
)
assert.doesNotMatch(
  workerDev,
  /--remote/,
  'worker:dev must never use the remote D1 database',
)
assert.match(workerDev, /--ip 127\.0\.0\.1/, 'worker:dev must use IPv4')
assert.match(workerDev, /--port 8788/, 'worker:dev must use port 8788')

assert.match(
  viteConfig,
  /host:\s*['"]127\.0\.0\.1['"]/,
  'Vite must use the documented IPv4 host',
)
assert.match(viteConfig, /port:\s*5174/, 'Vite must use port 5174')
assert.match(
  viteConfig,
  /strictPort:\s*true/,
  'Vite must fail clearly instead of silently changing ports',
)
assert.match(
  viteConfig,
  /target:\s*['"]http:\/\/127\.0\.0\.1:8788['"]/,
  'Vite must proxy API requests to the local vue-jueblog Worker',
)

console.log('Local development ports and database setup are consistent.')
