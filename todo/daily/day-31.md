# Day 31: 后端部署到 Cloudflare Workers

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 执行 `wrangler publish` 部署后端
- [ ] 测试 Workers API 响应性能
- [ ] 配置自定义域名绑定
- [ ] 设置监控和告警

## 📚 学习笔记

### Cloudflare Workers 部署架构

#### 边缘计算部署特点

```
传统部署 vs 边缘部署
┌─────────────────────────────────────────────────────────────────┐
│ 传统部署：用户 -> CDN -> 负载均衡 -> 应用服务器 -> 数据库    │
├─────────────────────────────────────────────────────────────────┤
│ 边缘部署：用户 -> Cloudflare Edge -> Workers -> D1        │
│                    ↑                                    │
│              全球200+节点                               │
└─────────────────────────────────────────────────────────────────┘
```

**边缘计算优势**：

1. **低延迟**：在全球200+个数据中心执行
2. **高可用**：自动故障转移和负载分散
3. **弹性伸缩**：根据流量自动扩容
4. **成本效益**：按请求付费，无需维护服务器

#### 生产环境部署配置

```toml
# wrangler.toml - 生产环境完整配置
name = "vue-blog-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# 全局环境变量
[vars]
NODE_ENV = "production"
API_VERSION = "v1"
CORS_ORIGIN = "https://blog.yourdomain.com"
RATE_LIMIT_ENABLED = "true"
LOGGING_LEVEL = "info"

# 生产环境 D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "vue-blog-prod"
database_id = "your-prod-database-id"

# KV 存储绑定（用于缓存和会话）
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-cache-namespace-id"

[[kv_namespaces]]
binding = "KV_SESSIONS"
id = "your-sessions-namespace-id"

# 自定义域名配置
[env.production]
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]

# 资源限制配置
[limits]
cpu_ms = 100         # CPU 使用限制
memory_mb = 128      # 内存使用限制

# 触发器配置
[[triggers]]
crons = ["0 2 * * *"]  # 每天凌晨2点执行清理任务
```

#### 部署前检查清单

```typescript
// scripts/pre-deploy-check.ts
import { execSync } from 'child_process'
import fs from 'fs'
import chalk from 'chalk'

interface DeploymentCheck {
  name: string
  check: () => boolean | Promise<boolean>
  required: boolean
  errorMessage: string
}

class DeploymentChecker {
  private checks: DeploymentCheck[] = [
    {
      name: '检查 TypeScript 编译',
      check: () => {
        try {
          execSync('npm run type-check', { stdio: 'pipe' })
          return true
        } catch {
          return false
        }
      },
      required: true,
      errorMessage: 'TypeScript 类型检查失败，请修复类型错误',
    },
    {
      name: '检查测试用例',
      check: () => {
        try {
          execSync('npm test', { stdio: 'pipe' })
          return true
        } catch {
          return false
        }
      },
      required: true,
      errorMessage: '单元测试失败，请修复测试问题',
    },
    {
      name: '检查环境变量配置',
      check: () => {
        const requiredVars = ['JWT_SECRET', 'DATABASE_URL']
        return requiredVars.every(key => process.env[key])
      },
      required: true,
      errorMessage: '缺少必需的环境变量',
    },
    {
      name: '检查数据库连接',
      check: async () => {
        try {
          const result = await fetch('/api/health')
          return result.ok
        } catch {
          return false
        }
      },
      required: true,
      errorMessage: '数据库连接失败',
    },
    {
      name: '检查依赖版本兼容性',
      check: () => {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
        const problematicDeps = Object.entries(
          packageJson.dependencies || {},
        ).filter(([name, version]) => {
          // 检查已知的不兼容版本
          return false // 简化示例
        })
        return problematicDeps.length === 0
      },
      required: false,
      errorMessage: '存在不兼容的依赖版本',
    },
  ]

  async runChecks(): Promise<boolean> {
    console.log(chalk.blue('🔍 开始部署前检查...'))

    let allPassed = true
    const results = []

    for (const check of this.checks) {
      const start = Date.now()

      try {
        const passed = await check.check()
        const duration = Date.now() - start

        if (passed) {
          console.log(chalk.green(`✅ ${check.name} (${duration}ms)`))
          results.push({ ...check, passed: true, duration })
        } else {
          const level = check.required ? chalk.red : chalk.yellow
          const icon = check.required ? '❌' : '⚠️'
          console.log(level(`${icon} ${check.name}: ${check.errorMessage}`))
          results.push({ ...check, passed: false, duration })

          if (check.required) {
            allPassed = false
          }
        }
      } catch (error) {
        const duration = Date.now() - start
        console.log(chalk.red(`❌ ${check.name}: 检查执行失败`))
        console.log(chalk.gray(`错误详情: ${error.message}`))
        results.push({ ...check, passed: false, duration, error })

        if (check.required) {
          allPassed = false
        }
      }
    }

    // 显示检查总结
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
    console.log('\n' + chalk.blue('📊 检查总结:'))
    console.log(`总耗时: ${totalDuration}ms`)
    console.log(
      `通过: ${results.filter(r => r.passed).length}/${results.length}`,
    )

    if (allPassed) {
      console.log(chalk.green('\n🎉 所有必需检查都已通过，可以进行部署！'))
    } else {
      console.log(chalk.red('\n🚫 部分必需检查失败，请修复后重试'))
    }

    return allPassed
  }
}

// 执行检查
if (require.main === module) {
  const checker = new DeploymentChecker()
  checker.runChecks().then(passed => {
    process.exit(passed ? 0 : 1)
  })
}

export { DeploymentChecker }
```

### Workers 性能监控

#### 内置性能指标收集

```typescript
// src/middleware/performance.ts
import { Context, Next } from 'hono'

export interface PerformanceMetrics {
  requestId: string
  method: string
  url: string
  duration: number
  status: number
  userAgent?: string
  country?: string
  colo?: string // Cloudflare 数据中心
  cpuTime?: number
  memory?: number
  dbQueryTime?: number
  cacheHitRate?: number
}

export const performanceMiddleware = async (c: Context, next: Next) => {
  const start = Date.now()
  const startCpuTime = performance.now()

  const requestId = c.req.header('cf-ray') || generateRequestId()
  const method = c.req.method
  const url = c.req.url
  const userAgent = c.req.header('user-agent')

  // Cloudflare 特有的地理信息
  const country = c.req.header('cf-ipcountry')
  const colo = c.req.header('cf-colo') // 数据中心代码

  let dbQueryTime = 0
  let cacheHitRate = 0

  // 包装数据库操作以收集查询时间
  const originalDb = c.env.DB
  if (originalDb) {
    c.env.DB = new Proxy(originalDb, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql: string) => {
            const statement = target.prepare(sql)
            return new Proxy(statement, {
              get(stmtTarget, stmtProp) {
                if (['first', 'all', 'run'].includes(stmtProp as string)) {
                  return async (...args: any[]) => {
                    const queryStart = performance.now()
                    const result = await stmtTarget[
                      stmtProp as keyof typeof stmtTarget
                    ](...args)
                    dbQueryTime += performance.now() - queryStart
                    return result
                  }
                }
                return stmtTarget[stmtProp as keyof typeof stmtTarget]
              },
            })
          }
        }
        return target[prop as keyof typeof target]
      },
    })
  }

  let error: any = null

  try {
    await next()
  } catch (err) {
    error = err
    throw err
  } finally {
    const duration = Date.now() - start
    const cpuTime = performance.now() - startCpuTime
    const status = c.res.status

    const metrics: PerformanceMetrics = {
      requestId,
      method,
      url,
      duration,
      status,
      userAgent,
      country,
      colo,
      cpuTime,
      dbQueryTime,
      cacheHitRate,
    }

    // 记录性能指标
    await recordMetrics(metrics, c.env)

    // 设置性能相关响应头
    c.header('X-Request-ID', requestId)
    c.header('X-Response-Time', `${duration}ms`)
    c.header('X-Served-By', colo || 'unknown')

    // 慢请求警告
    if (duration > 1000) {
      console.warn(`Slow request detected: ${method} ${url} took ${duration}ms`)
    }
  }
}

async function recordMetrics(metrics: PerformanceMetrics, env: any) {
  try {
    // 发送到 Cloudflare Analytics Engine
    if (env.ANALYTICS_ENGINE) {
      await env.ANALYTICS_ENGINE.writeDataPoint({
        blobs: [
          metrics.requestId,
          metrics.method,
          metrics.url,
          metrics.userAgent || 'unknown',
          metrics.country || 'unknown',
          metrics.colo || 'unknown',
        ],
        doubles: [
          metrics.duration,
          metrics.status,
          metrics.cpuTime || 0,
          metrics.dbQueryTime || 0,
        ],
        indexes: [metrics.url, metrics.status.toString()],
      })
    }

    // 记录到应用日志
    console.log('Performance Metrics:', {
      requestId: metrics.requestId,
      duration: metrics.duration,
      status: metrics.status,
      dbQueryTime: metrics.dbQueryTime,
      country: metrics.country,
      colo: metrics.colo,
    })
  } catch (error) {
    console.error('Failed to record metrics:', error)
  }
}

function generateRequestId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}
```

## 🛠️ 实践操作

### 步骤1：最终部署前检查

```bash
# 运行完整的检查流程
npm run pre-deploy-check

# 检查 wrangler 配置
wrangler whoami
wrangler kv:namespace list
wrangler d1 list

# 验证密钥配置
wrangler secret list

# 最终构建检查
npm run build
npm run type-check
npm test
```

### 步骤2：执行生产环境部署

```bash
# 部署到生产环境
wrangler publish --env production

# 部署输出示例：
# ☁️ wrangler 3.x.x
# Total Upload: xx.xx KiB / gzip: xx.xx KiB
# Uploaded vue-blog-backend-prod (x.xx sec)
# Published vue-blog-backend-prod (x.xx sec)
#   https://vue-blog-backend-prod.your-username.workers.dev
#   Custom Domain: https://api.yourdomain.com
```

**部署验证脚本**：

```bash
#!/bin/bash
# scripts/verify-deployment.sh

API_URL="https://api.yourdomain.com"
TEST_ENDPOINTS=(
    "/api/health"
    "/api/trpc/users.me"
    "/api/trpc/articles.getList"
)

echo "🔍 验证部署结果..."

for endpoint in "${TEST_ENDPOINTS[@]}"; do
    echo "测试: $API_URL$endpoint"

    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")

    if [ "$response" = "200" ] || [ "$response" = "401" ]; then
        echo "✅ $endpoint - OK ($response)"
    else
        echo "❌ $endpoint - FAIL ($response)"
        exit 1
    fi
done

echo "🎉 所有端点验证通过！"
```

### 步骤3：配置自定义域名和 SSL

```bash
# 方法一：通过 CLI 配置
wrangler route add "api.yourdomain.com/*" vue-blog-backend-prod

# 方法二：在 wrangler.toml 中配置（推荐）
[env.production]
routes = [
  { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

**DNS 配置**：

```
# 在 Cloudflare DNS 中添加记录
Type: CNAME
Name: api
Content: vue-blog-backend-prod.your-username.workers.dev
Proxy: ✅ (Proxied)
TTL: Auto
```

### 步骤4：设置监控和告警

#### Cloudflare Analytics 配置

```toml
# wrangler.toml
[[analytics_engine_datasets]]
binding = "ANALYTICS_ENGINE"
dataset = "vue_blog_metrics"
```

#### 告警规则设置

```typescript
// src/utils/alerting.ts
export interface AlertRule {
  name: string
  condition: (metrics: PerformanceMetrics[]) => boolean
  threshold: number
  timeWindow: number // 分钟
  severity: 'low' | 'medium' | 'high' | 'critical'
  cooldown: number // 分钟，防止重复告警
}

export const ALERT_RULES: AlertRule[] = [
  {
    name: 'High Error Rate',
    condition: metrics => {
      const errorCount = metrics.filter(m => m.status >= 500).length
      return errorCount > 10 // 10个5xx错误
    },
    threshold: 10,
    timeWindow: 5,
    severity: 'critical',
    cooldown: 15,
  },
  {
    name: 'Slow Response Time',
    condition: metrics => {
      const avgDuration =
        metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      return avgDuration > 2000 // 平均响应时间超过2秒
    },
    threshold: 2000,
    timeWindow: 10,
    severity: 'high',
    cooldown: 10,
  },
  {
    name: 'Database Query Slow',
    condition: metrics => {
      const avgDbTime =
        metrics.reduce((sum, m) => sum + (m.dbQueryTime || 0), 0) /
        metrics.length
      return avgDbTime > 500 // 数据库查询时间超过500ms
    },
    threshold: 500,
    timeWindow: 5,
    severity: 'medium',
    cooldown: 20,
  },
]

// 告警发送
export async function sendAlert(
  rule: AlertRule,
  metrics: PerformanceMetrics[],
) {
  const alertData = {
    rule: rule.name,
    severity: rule.severity,
    timestamp: new Date().toISOString(),
    metrics: metrics.length,
    details: {
      avgDuration:
        metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
      errorCount: metrics.filter(m => m.status >= 400).length,
      topCountries: getTopCountries(metrics),
      topErrors: getTopErrors(metrics),
    },
  }

  // 发送到多个渠道
  await Promise.allSettled([
    sendToSlack(alertData),
    sendToEmail(alertData),
    sendToWebhook(alertData),
  ])
}

function getTopCountries(
  metrics: PerformanceMetrics[],
): Record<string, number> {
  return metrics.reduce(
    (acc, m) => {
      const country = m.country || 'unknown'
      acc[country] = (acc[country] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
}

function getTopErrors(metrics: PerformanceMetrics[]): Record<number, number> {
  return metrics
    .filter(m => m.status >= 400)
    .reduce(
      (acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1
        return acc
      },
      {} as Record<number, number>,
    )
}
```

## 🔍 深入思考

### 边缘计算的生产环境考虑

1. **冷启动优化**

   - 最小化依赖包大小
   - 使用懒加载模式
   - 预热关键路径代码

2. **数据一致性**

   - D1 数据库的最终一致性
   - 分布式缓存失效策略
   - 跨区域数据同步

3. **错误处理和降级**
   - 优雅的服务降级机制
   - 断路器模式实现
   - 自动故障恢复

### 生产环境最佳实践

```typescript
// 生产环境优化配置
export const PRODUCTION_CONFIG = {
  // 性能优化
  performance: {
    maxConcurrentRequests: 1000,
    requestTimeout: 30000,
    dbConnectionPool: 10,
    cacheExpiration: 300, // 5分钟
  },

  // 安全配置
  security: {
    rateLimitPerMinute: 100,
    jwtExpirationHours: 24,
    passwordHashRounds: 12,
    enableCSP: true,
  },

  // 监控配置
  monitoring: {
    enableDetailedLogs: false, // 生产环境关闭详细日志
    logLevel: 'info',
    metricsCollection: true,
    errorReporting: true,
  },

  // 缓存策略
  cache: {
    staticAssets: '1y', // 静态资源缓存1年
    apiResponses: '5m', // API响应缓存5分钟
    userSessions: '24h', // 用户会话缓存24小时
    dbQueries: '1h', // 数据库查询缓存1小时
  },
}
```

## ❓ 遇到的问题

### 问题 1：Workers 内存限制导致部署失败

**问题描述**：包体积过大，超过 Workers 1MB 的限制  
**解决方案**：

```bash
# 分析包大小
npx wrangler dev --inspect

# 优化依赖
npm install --production
npm prune

# 使用 tree-shaking
# 在 wrangler.toml 中启用
[build]
command = "npm run build"
cwd = "."
watch_dir = "src"
```

### 问题 2：自定义域名 SSL 证书配置失败

**问题描述**：HTTPS 访问时出现证书错误  
**解决方案**：

1. 确保域名已添加到 Cloudflare
2. 启用 "Universal SSL"
3. 设置 SSL/TLS 模式为 "Full (Strict)"
4. 等待证书颁发（最多24小时）

### 问题 3：跨域配置在生产环境不生效

**问题描述**：前端无法访问 Workers API  
**解决方案**：

```typescript
// 确保 CORS 中间件正确配置生产环境域名
const corsOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://www.yourdomain.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
```

## 💡 个人心得

### 今天最大的收获

完成了后端到 Cloudflare Workers 的生产环境部署，体验了边缘计算的强大能力和全球分布的优势。

### 边缘计算部署的核心洞察

1. **全球化思维**：从一开始就要考虑全球用户的访问体验
2. **性能监控**：边缘环境的监控比传统服务器更加重要
3. **渐进式部署**：使用金丝雀发布减少风险
4. **自动化运维**：Workers 的自动伸缩能力需要配合智能监控

## 📋 行动清单

### 今日完成

- [x] 配置完整的生产环境 wrangler.toml
- [x] 执行 wrangler publish 部署到 Workers
- [x] 设置自定义域名和 SSL 证书
- [x] 建立性能监控和告警机制

### 明日预习

- [ ] 了解 Cloudflare Pages 自动部署流程
- [ ] 准备前端生产构建配置
- [ ] 思考前后端集成测试方案

## 🔗 有用链接

- [Cloudflare Workers 部署文档](https://developers.cloudflare.com/workers/get-started/guide/)
- [Workers 性能最佳实践](https://developers.cloudflare.com/workers/learning/performance/)
- [自定义域名配置](https://developers.cloudflare.com/workers/platform/routing/custom-domains/)
- [Analytics Engine 使用指南](https://developers.cloudflare.com/analytics/analytics-engine/)

---

**📝 明日重点**：完成前端部署到 Cloudflare Pages，实现完整的前后端集成。
