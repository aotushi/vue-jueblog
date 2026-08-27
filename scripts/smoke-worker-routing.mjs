import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wranglerCli = path.join(
  projectRoot,
  'node_modules',
  'wrangler',
  'bin',
  'wrangler.js',
)

async function getFreePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  const port = address.port
  server.close()
  await once(server, 'close')
  return port
}

function get(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: 'GET',
        headers,
      },
      response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            contentType: response.headers['content-type'] ?? '',
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function waitForWorker(port, child) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Wrangler exited before becoming ready (${child.exitCode})`)
    }
    try {
      const response = await get(port, '/api2/articles/category')
      if (response.status === 200) return
    } catch {
      // Wrangler is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for Wrangler')
}

const port = await getFreePort()
const output = []
const child = spawn(
  process.execPath,
  [wranglerCli, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port)],
  { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] },
)

child.stdout.on('data', chunk => output.push(chunk.toString()))
child.stderr.on('data', chunk => output.push(chunk.toString()))

try {
  await waitForWorker(port, child)

  const apiResponse = await get(port, '/api2/articles/category')
  assert.equal(apiResponse.status, 200)
  assert.match(apiResponse.contentType, /application\/json/)

  for (const pathname of ['/article/17', '/shortmsg', '/user/1']) {
    const navigationResponse = await get(port, pathname, {
      Accept: 'text/html',
      'Sec-Fetch-Mode': 'navigate',
    })
    assert.equal(navigationResponse.status, 200, pathname)
    assert.match(navigationResponse.contentType, /text\/html/, pathname)
    assert.match(navigationResponse.body, /<div id="app"><\/div>/, pathname)
  }

  const missingApiResponse = await get(port, '/api2/does-not-exist')
  assert.equal(missingApiResponse.status, 404)
  assert.match(missingApiResponse.contentType, /application\/json/)
  assert.deepEqual(JSON.parse(missingApiResponse.body), {
    code: 404,
    message: '接口不存在',
  })

  console.log('Worker API and SPA navigation routing are healthy.')
} catch (error) {
  const logs = output.join('').trim()
  if (logs) console.error(logs)
  throw error
} finally {
  child.kill()
  await Promise.race([
    once(child, 'exit'),
    new Promise(resolve => setTimeout(resolve, 2_000)),
  ])
}
