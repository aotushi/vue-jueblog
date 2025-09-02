# Day 32: 前端部署到 Cloudflare Pages

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 配置 Cloudflare Pages 自动部署
- [ ] 连接 GitHub 仓库自动构建
- [ ] 设置自定义域名和 DNS
- [ ] 测试前后端完整交互

## 📚 学习笔记

### Cloudflare Pages 部署架构

#### 静态站点部署优势

```
传统前端部署 vs Cloudflare Pages
┌─────────────────────────────────────────────────────────────────┐
│ 传统部署：代码推送 -> CI/CD -> 构建 -> 上传到服务器/CDN       │
├─────────────────────────────────────────────────────────────────┤
│ Pages 部署：Git 推送 -> 自动触发构建 -> 全球边缘分发          │
│             ↑                                          │
│         GitHub/GitLab                                    │
│         自动集成                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Cloudflare Pages 核心特性**：

1. **Git 集成**：支持 GitHub、GitLab 自动部署
2. **全球 CDN**：200+ 边缘节点自动分发
3. **预览环境**：每个 PR 自动生成预览链接
4. **Functions 集成**：可与 Workers 无缝集成
5. **零配置 HTTPS**：自动 SSL 证书管理

#### Pages Functions 与 Workers 集成

```typescript
// functions/api/[[path]].ts - Pages Functions 路由
export async function onRequest(context) {
  // 代理 API 请求到 Workers
  const { request, env } = context
  const url = new URL(request.url)

  // 将 /api/* 请求转发到 Workers
  if (url.pathname.startsWith('/api/')) {
    const workerUrl = `https://api.yourdomain.com${url.pathname}${url.search}`
    return fetch(workerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    })
  }

  // 其他请求返回 404
  return new Response('Not Found', { status: 404 })
}
```

#### 生产环境构建优化

```javascript
// vite.config.ts - Pages 专用配置
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    // PWA 插件配置
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\\/\\/api\\.yourdomain\\.com\\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1小时
              }
            }
          }
        ]
      }
    })
  ],

  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false, // 生产环境关闭

    rollupOptions: {
      output: {
        // 优化资源分组
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          ui: ['@headlessui/vue', '@heroicons/vue'],
          utils: ['date-fns', 'lodash-es']
        },

        // 文件命名策略
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          return `assets/${ext}/[name]-[hash].${ext}`
        }
      }
    },

    // 性能预算
    chunkSizeWarningLimit: 500
  },

  // Pages 环境变量
  define: {
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
})
```

### 自动化部署配置

#### GitHub Actions 集成

```yaml
# .github/workflows/deploy-preview.yml
name: Deploy Preview to Cloudflare Pages
on:
  pull_request:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/**'

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run tests
        working-directory: ./frontend
        run: npm test

      - name: Build
        working-directory: ./frontend
        run: npm run build
        env:
          VITE_API_BASE_URL: https://api-preview.yourdomain.com

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: vue-blog-frontend
          directory: frontend/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

#### 环境变量管理

```javascript
// src/config/environment.ts
export const config = {
  // API 配置
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.yourdomain.com',
    timeout: 30000,
    retries: 3,
  },

  // 应用配置
  app: {
    name: 'Vue Blog',
    version: import.meta.env.VITE_APP_VERSION || '2.0.0',
    environment: import.meta.env.MODE,
    buildTime: __BUILD_TIME__,
  },

  // 功能开关
  features: {
    enablePWA: import.meta.env.VITE_ENABLE_PWA === 'true',
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    enableServiceWorker: import.meta.env.PROD,
  },

  // 缓存配置
  cache: {
    apiCacheTtl: 5 * 60 * 1000, // 5分钟
    staticCacheTtl: 24 * 60 * 60 * 1000, // 24小时
    imageCacheTtl: 7 * 24 * 60 * 60 * 1000, // 7天
  },
}

// 环境检测工具
export const isDevelopment = config.app.environment === 'development'
export const isProduction = config.app.environment === 'production'
export const isPreview = config.app.environment === 'preview'
```

#### 多环境部署策略

```yaml
# cloudflare-pages.yml - Pages 配置
production_branch: main
preview_branch_includes: ['*']
preview_branch_excludes: ['main']

build:
  command: npm run build
  destination: dist
  root_dir: frontend

compatibility_flags:
  - nodejs_compat

env_vars:
  production:
    VITE_API_BASE_URL: https://api.yourdomain.com
    VITE_APP_ENV: production
    VITE_ENABLE_PWA: true
    VITE_ENABLE_ANALYTICS: true

  preview:
    VITE_API_BASE_URL: https://api-dev.yourdomain.com
    VITE_APP_ENV: preview
    VITE_ENABLE_PWA: false
    VITE_ENABLE_ANALYTICS: false

# 自定义响应头
headers:
  /*:
    - X-Frame-Options: DENY
    - X-Content-Type-Options: nosniff
    - Referrer-Policy: strict-origin-when-cross-origin

  /assets/*:
    - Cache-Control: public, max-age=31536000, immutable

  /*.html:
    - Cache-Control: public, max-age=0, must-revalidate
```

### 前后端集成优化

#### API 客户端统一配置

```typescript
// src/services/api-client.ts
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { config } from '@/config/environment'

class ApiClient {
  private client: AxiosInstance
  private requestRetryCount = 0
  private maxRetries = config.api.retries

  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': config.app.version,
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // 请求拦截器
    this.client.interceptors.request.use(
      config => {
        // 添加认证令牌
        const token = this.getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // 添加请求指纹
        const fingerprint = this.getClientFingerprint()
        if (fingerprint) {
          config.headers['X-Client-Fingerprint'] = fingerprint
        }

        // 请求日志
        if (!isProduction) {
          console.log(
            `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`,
          )
        }

        return config
      },
      error => Promise.reject(error),
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // 响应日志
        if (!isProduction) {
          console.log(
            `✅ API Response: ${response.status} ${response.config.url}`,
          )
        }

        this.requestRetryCount = 0
        return response
      },
      async error => {
        const originalRequest = error.config

        // 处理认证错误
        if (error.response?.status === 401) {
          await this.handleAuthError()
          return Promise.reject(error)
        }

        // 自动重试机制
        if (this.shouldRetry(error) && !originalRequest._retry) {
          originalRequest._retry = true
          this.requestRetryCount++

          const delay = Math.pow(2, this.requestRetryCount) * 1000 // 指数退避
          await this.delay(delay)

          return this.client(originalRequest)
        }

        return Promise.reject(error)
      },
    )
  }

  private shouldRetry(error: any): boolean {
    if (this.requestRetryCount >= this.maxRetries) {
      return false
    }

    // 可重试的错误类型
    return (
      !error.response || // 网络错误
      error.response.status >= 500 || // 服务器错误
      error.response.status === 429 || // 限流
      error.code === 'ECONNABORTED' // 超时
    )
  }

  private async handleAuthError() {
    // 清除过期令牌
    this.clearAuthToken()

    // 重定向到登录页
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    await authStore.logout()

    // 跳转到登录页面
    const router = (await import('@/router')).default
    router.push('/login')
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token')
  }

  private clearAuthToken(): void {
    localStorage.removeItem('auth_token')
  }

  private getClientFingerprint(): string {
    // 生成客户端指纹
    return btoa(
      `${navigator.userAgent}_${screen.width}x${screen.height}_${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 公共 API 方法
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }
}

export const apiClient = new ApiClient()
```

#### 健康检查和监控

```typescript
// src/utils/health-check.ts
export interface HealthStatus {
  frontend: {
    version: string
    buildTime: string
    status: 'healthy' | 'degraded' | 'unhealthy'
  }
  backend: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    lastChecked: string
  }
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastChecked: string
  }
}

class HealthMonitor {
  private checkInterval = 30000 // 30秒
  private intervalId: NodeJS.Timeout | null = null
  private status: HealthStatus = {
    frontend: {
      version: config.app.version,
      buildTime: config.app.buildTime,
      status: 'healthy',
    },
    backend: {
      status: 'unhealthy',
      responseTime: 0,
      lastChecked: new Date().toISOString(),
    },
    database: {
      status: 'unhealthy',
      lastChecked: new Date().toISOString(),
    },
  }

  start() {
    this.checkHealth()
    this.intervalId = setInterval(() => this.checkHealth(), this.checkInterval)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async checkHealth() {
    try {
      const startTime = performance.now()

      const response = await fetch(`${config.api.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)

      if (response.ok) {
        const healthData = await response.json()

        this.status.backend = {
          status: 'healthy',
          responseTime,
          lastChecked: new Date().toISOString(),
        }

        this.status.database = {
          status: healthData.database?.status || 'unknown',
          lastChecked: new Date().toISOString(),
        }
      } else {
        throw new Error(`Health check failed: ${response.status}`)
      }
    } catch (error) {
      console.warn('Backend health check failed:', error)

      this.status.backend = {
        status: 'unhealthy',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
      }

      this.status.database = {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
      }
    }

    // 触发状态更新事件
    this.emitStatusUpdate()
  }

  private emitStatusUpdate() {
    window.dispatchEvent(
      new CustomEvent('health-status-update', {
        detail: this.status,
      }),
    )
  }

  getStatus(): HealthStatus {
    return { ...this.status }
  }

  isHealthy(): boolean {
    return (
      this.status.frontend.status === 'healthy' &&
      this.status.backend.status === 'healthy' &&
      this.status.database.status === 'healthy'
    )
  }
}

export const healthMonitor = new HealthMonitor()

// 在应用启动时开始监控
if (isProduction) {
  healthMonitor.start()
}
```

## 🛠️ 实践操作

### 步骤1：配置 Cloudflare Pages 项目

```bash
# 1. 登录 Cloudflare Dashboard
# 2. 进入 Pages 面板
# 3. 点击 "Create a project"

# 连接 Git 仓库配置：
Project name: vue-blog-frontend
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: frontend (可选)

# 环境变量配置：
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_APP_ENV=production
VITE_ENABLE_PWA=true
NODE_VERSION=18
```

### 步骤2：本地构建验证

```bash
# 切换到前端目录
cd frontend

# 安装依赖
npm install

# 设置生产环境变量
export VITE_API_BASE_URL=https://api.yourdomain.com
export VITE_APP_ENV=production

# 本地构建测试
npm run build

# 预览构建结果
npm run preview

# 验证构建产物
ls -la dist/
du -sh dist/
```

**构建优化验证**：

```bash
#!/bin/bash
# scripts/build-validation.sh

echo "🔍 验证构建产物..."

# 检查关键文件是否存在
REQUIRED_FILES=(
    "dist/index.html"
    "dist/assets/js"
    "dist/assets/css"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -e "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 缺失"
        exit 1
    fi
done

# 检查包大小
BUNDLE_SIZE=$(du -sh dist/ | cut -f1)
echo "📦 构建产物大小: $BUNDLE_SIZE"

# 检查 gzip 压缩大小
if command -v gzip >/dev/null 2>&1; then
    GZIP_SIZE=$(tar -czf - dist/ | wc -c | numfmt --to=iec)
    echo "🗜️  Gzip 压缩大小: $GZIP_SIZE"
fi

echo "✅ 构建验证完成"
```

### 步骤3：自定义域名配置

```bash
# 在 Cloudflare Pages 中配置自定义域名
# 1. 进入项目设置
# 2. 点击 "Custom domains"
# 3. 添加域名: yourdomain.com, www.yourdomain.com

# DNS 记录配置（在 Cloudflare DNS 中）：
# CNAME yourdomain.com -> vue-blog-frontend.pages.dev
# CNAME www -> yourdomain.com
```

**自动化 DNS 配置**：

```javascript
// scripts/configure-dns.js
const cloudflare = require('cloudflare')({
  token: process.env.CLOUDFLARE_API_TOKEN,
})

async function configureDNS() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const domain = process.env.DOMAIN
  const pagesUrl = `${process.env.PAGES_PROJECT_NAME}.pages.dev`

  try {
    // 配置根域名 CNAME
    await cloudflare.dnsRecords.add(zoneId, {
      type: 'CNAME',
      name: domain,
      content: pagesUrl,
      proxied: true,
    })

    // 配置 www 子域名
    await cloudflare.dnsRecords.add(zoneId, {
      type: 'CNAME',
      name: `www.${domain}`,
      content: domain,
      proxied: true,
    })

    console.log('✅ DNS 记录配置成功')
  } catch (error) {
    console.error('❌ DNS 配置失败:', error)
  }
}

configureDNS()
```

### 步骤4：集成测试验证

```typescript
// tests/e2e/integration.spec.ts
import { test, expect } from '@playwright/test'

test.describe('前后端集成测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('首页加载正常', async ({ page }) => {
    await expect(page).toHaveTitle(/Vue Blog/)
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('API 连接正常', async ({ page }) => {
    // 等待 API 健康检查
    await page.waitForTimeout(2000)

    const healthStatus = await page.evaluate(() => {
      return window.healthMonitor?.getStatus()
    })

    expect(healthStatus.backend.status).toBe('healthy')
    expect(healthStatus.database.status).toBe('healthy')
  })

  test('用户注册流程', async ({ page }) => {
    await page.click('text=注册')
    await expect(page).toHaveURL('/register')

    await page.fill('[data-testid=phone-input]', '13800138000')
    await page.fill('[data-testid=username-input]', 'testuser')
    await page.fill('[data-testid=password-input]', 'TestPassword123!')

    await page.click('[data-testid=register-button]')

    // 验证注册成功
    await expect(page.locator('.success-message')).toBeVisible()
  })

  test('文章列表加载', async ({ page }) => {
    await page.goto('/articles')

    // 等待文章列表加载
    await expect(page.locator('.article-list')).toBeVisible()
    await expect(page.locator('.article-item')).toHaveCountGreaterThan(0)
  })

  test('响应式设计适配', async ({ page }) => {
    // 测试移动端
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('.mobile-menu')).toBeVisible()

    // 测试桌面端
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('.desktop-nav')).toBeVisible()
  })
})
```

**自动化测试脚本**：

```bash
#!/bin/bash
# scripts/integration-test.sh

FRONTEND_URL=${1:-"https://yourdomain.com"}
BACKEND_URL=${2:-"https://api.yourdomain.com"}

echo "🧪 开始集成测试..."
echo "前端地址: $FRONTEND_URL"
echo "后端地址: $BACKEND_URL"

# 等待服务启动
echo "⏳ 等待服务就绪..."
curl -f "$BACKEND_URL/api/health" --max-time 30 --retry 5 --retry-delay 2

# 运行 E2E 测试
npx playwright test --base-url="$FRONTEND_URL"

if [ $? -eq 0 ]; then
    echo "✅ 集成测试通过"
else
    echo "❌ 集成测试失败"
    exit 1
fi
```

## 🔍 深入思考

### 前端部署的现代化策略

1. **边缘优先架构**

   - 静态内容全球分发
   - 动态内容边缘缓存
   - API 请求就近路由

2. **渐进式部署**

   - 蓝绿部署减少停机时间
   - 金丝雀发布降低风险
   - A/B 测试支持产品迭代

3. **性能监控**
   - Core Web Vitals 监控
   - 真实用户体验指标
   - 错误率和可用性监控

### JAMstack 架构优势

```typescript
// JAMstack 核心理念实现
export const jamstackBenefits = {
  // JavaScript: 动态功能
  clientSideLogic: {
    reactivity: 'Vue 3 Composition API',
    stateManagement: 'Pinia',
    routing: 'Vue Router',
    httpClient: 'Custom API Client',
  },

  // APIs: 服务端功能
  serverlessAPI: {
    platform: 'Cloudflare Workers',
    framework: 'Hono + tRPC',
    database: 'D1 (SQLite)',
    authentication: 'JWT + Session',
  },

  // Markup: 预构建标记
  staticGeneration: {
    buildTool: 'Vite',
    optimization: 'Code Splitting + Tree Shaking',
    caching: 'Aggressive Static Caching',
    distribution: 'Global CDN',
  },
}
```

## ❓ 遇到的问题

### 问题 1：构建时环境变量未正确注入

**问题描述**：生产环境下 API 地址仍然指向开发环境  
**解决方案**：

```typescript
// 确保在 Cloudflare Pages 中正确配置环境变量
// 使用 define 选项替代 env 前缀
export default defineConfig({
  define: {
    __API_BASE_URL__: JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:8787',
    ),
  },
})
```

### 问题 2：大文件导致构建超时

**问题描述**：包含大型资源文件导致 Pages 构建超时  
**解决方案**：

- 使用 CDN 托管大型资源
- 启用增量构建
- 优化图片和字体文件

### 问题 3：CORS 跨域问题

**问题描述**：生产环境下前端无法访问 API  
**解决方案**：

```typescript
// 确保 Workers 中正确配置生产环境域名
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  'https://*.pages.dev', // 预览环境
]
```

## 💡 个人心得

### 今天最大的收获

成功实现了前端到 Cloudflare Pages 的自动化部署，体验了现代 JAMstack 架构的完整部署流程。

### 现代前端部署的核心洞察

1. **自动化优先**：从代码提交到生产部署的全自动化流程
2. **全球化部署**：利用边缘网络提供全球一致的用户体验
3. **环境隔离**：完善的多环境管理和配置策略
4. **监控驱动**：基于性能和错误监控的持续优化

## 📋 行动清单

### 今日完成

- [x] 配置 Cloudflare Pages 自动部署管道
- [x] 连接 GitHub 仓库实现 CI/CD 自动化
- [x] 设置生产环境自定义域名和 SSL
- [x] 实现前后端集成测试验证

### 明日预习

- [ ] 了解全面功能测试的测试用例设计
- [ ] 准备用户流程测试和边界条件测试
- [ ] 思考性能基准测试方案

## 🔗 有用链接

- [Cloudflare Pages 部署文档](https://developers.cloudflare.com/pages/get-started/)
- [Pages Functions 集成指南](https://developers.cloudflare.com/pages/platform/functions/)
- [自定义域名配置](https://developers.cloudflare.com/pages/platform/custom-domains/)
- [JAMstack 架构最佳实践](https://jamstack.org/best-practices/)

---

**📝 明日重点**：进行全面的功能测试，验证系统各个模块的完整性和用户体验。
