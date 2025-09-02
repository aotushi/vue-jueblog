# Day 24: 前端构建优化与性能监控

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> ⏱️ **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 优化 Vite 构建配置，实现高效的代码分割
- [ ] 实现组件和路由的懒加载策略
- [ ] 集成性能监控和错误追踪系统
- [ ] 建立前端性能优化最佳实践

## 📚 学习笔记

### Vite 构建优化策略

#### 高级构建配置

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { compression } from 'vite-plugin-compression'
import { createHtmlPlugin } from 'vite-plugin-html'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue({
        // 启用响应式语法糖
        reactivityTransform: true,
        // 生产环境移除开发工具
        template: {
          compilerOptions: {
            isCustomElement: tag => tag.startsWith('ion-'),
          },
        },
      }),

      // HTML 模板处理
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            title: 'Vue 博客 - 现代化技术博客平台',
            description: '基于 Vue 3 + tRPC + Cloudflare D1 构建的现代博客系统',
          },
        },
      }),

      // Gzip 压缩
      compression({
        algorithm: 'gzip',
        ext: '.gz',
      }),

      // Brotli 压缩
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
      }),

      // 构建分析器
      mode === 'analyze' &&
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
        }),
    ].filter(Boolean),

    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@/components': resolve(__dirname, 'src/components'),
        '@/utils': resolve(__dirname, 'src/utils'),
        '@/stores': resolve(__dirname, 'src/stores'),
        '@/types': resolve(__dirname, 'src/types'),
      },
    },

    // 开发服务器配置
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8787',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
      },
    },

    // 构建配置
    build: {
      target: 'es2015',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',

      // 代码分割策略
      rollupOptions: {
        output: {
          // 手动代码分割
          manualChunks: {
            // 第三方库分离
            vendor: ['vue', 'vue-router', 'pinia'],
            ui: ['element-plus'],
            utils: ['axios', 'dayjs', 'lodash-es'],

            // 功能模块分离
            auth: ['src/stores/auth.ts', 'src/composables/useAuth.ts'],
            articles: [
              'src/stores/articles.ts',
              'src/composables/useArticles.ts',
            ],
            editor: ['src/components/editor/'],
          },

          // 文件命名策略
          chunkFileNames: chunkInfo => {
            const facadeModuleId = chunkInfo.facadeModuleId
            if (facadeModuleId) {
              const fileName = facadeModuleId
                .split('/')
                .pop()
                ?.replace('.vue', '')
              return `js/[name]-[hash].js`
            }
            return 'js/[name]-[hash].js'
          },

          assetFileNames: assetInfo => {
            const info = assetInfo.name!.split('.')
            const ext = info[info.length - 1]

            if (
              /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name!)
            ) {
              return 'media/[name]-[hash].[ext]'
            }

            if (/\.(png|jpe?g|gif|svg)(\?.*)?$/.test(assetInfo.name!)) {
              return 'images/[name]-[hash].[ext]'
            }

            if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name!)) {
              return 'fonts/[name]-[hash].[ext]'
            }

            return 'assets/[name]-[hash].[ext]'
          },
        },
      },

      // 压缩配置
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
    },

    // CSS 处理
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
      postcss: {
        plugins: [require('tailwindcss'), require('autoprefixer')],
      },
    },

    // 优化配置
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'element-plus',
        '@element-plus/icons-vue',
      ],
      exclude: ['@vueuse/core'],
    },

    // 环境变量
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
    },
  }
})
```

#### 组件懒加载策略

```typescript
// src/router/lazy-loading.ts
import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'

// 懒加载包装器
export const createAsyncComponent = (
  loader: () => Promise<Component>,
  options?: {
    loadingComponent?: Component
    errorComponent?: Component
    delay?: number
    timeout?: number
  },
) => {
  return defineAsyncComponent({
    loader,
    loadingComponent: options?.loadingComponent,
    errorComponent: options?.errorComponent,
    delay: options?.delay || 200,
    timeout: options?.timeout || 30000,
  })
}

// 路由级别的懒加载
export const lazyRoutes = {
  Home: () => import('@/views/Home.vue'),
  Articles: () => import('@/views/Articles.vue'),
  ArticleDetail: () => import('@/views/ArticleDetail.vue'),
  Profile: () => import('@/views/Profile.vue'),
  Dashboard: () => import('@/views/Dashboard.vue'),
  Editor: () => import('@/views/Editor.vue'),
}

// 组件级别的懒加载
export const lazyComponents = {
  // 编辑器组件（较重）
  MarkdownEditor: createAsyncComponent(
    () => import('@/components/editor/MarkdownEditor.vue'),
    {
      loadingComponent: defineComponent({
        template: '<div class="loading-editor">加载编辑器中...</div>',
      }),
    },
  ),

  // 图表组件
  ChartComponent: createAsyncComponent(
    () => import('@/components/charts/ChartComponent.vue'),
  ),

  // 评论系统
  CommentSystem: createAsyncComponent(
    () => import('@/components/comments/CommentSystem.vue'),
  ),
}
```

### 性能监控系统

#### Web Vitals 监控

```typescript
// src/utils/performance.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

export interface PerformanceMetrics {
  CLS: number // Cumulative Layout Shift
  FID: number // First Input Delay
  FCP: number // First Contentful Paint
  LCP: number // Largest Contentful Paint
  TTFB: number // Time to First Byte
}

export interface PageLoadMetrics {
  url: string
  loadTime: number
  domContentLoaded: number
  firstPaint: number
  firstContentfulPaint: number
  timestamp: number
  userAgent: string
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {}
  private pageLoadMetrics: PageLoadMetrics[] = []

  constructor(
    private reportCallback?: (
      metrics: PerformanceMetrics | PageLoadMetrics,
    ) => void,
  ) {
    this.initWebVitals()
    this.initNavigationTiming()
    this.initResourceTiming()
  }

  // Web Vitals 监控
  private initWebVitals() {
    getCLS(metric => {
      this.metrics.CLS = metric.value
      this.reportMetric('CLS', metric.value)
    })

    getFID(metric => {
      this.metrics.FID = metric.value
      this.reportMetric('FID', metric.value)
    })

    getFCP(metric => {
      this.metrics.FCP = metric.value
      this.reportMetric('FCP', metric.value)
    })

    getLCP(metric => {
      this.metrics.LCP = metric.value
      this.reportMetric('LCP', metric.value)
    })

    getTTFB(metric => {
      this.metrics.TTFB = metric.value
      this.reportMetric('TTFB', metric.value)
    })
  }

  // 页面加载性能监控
  private initNavigationTiming() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming

        if (navigation) {
          const metrics: PageLoadMetrics = {
            url: window.location.href,
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded:
              navigation.domContentLoadedEventEnd -
              navigation.domContentLoadedEventStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint(),
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
          }

          this.pageLoadMetrics.push(metrics)
          this.reportCallback?.(metrics)
        }
      }, 0)
    })
  }

  // 资源加载监控
  private initResourceTiming() {
    const observer = new PerformanceObserver(list => {
      const entries = list.getEntries()

      entries.forEach(entry => {
        if (entry.duration > 1000) {
          // 资源加载时间超过1秒
          console.warn(
            `慢资源加载: ${entry.name} - ${entry.duration.toFixed(2)}ms`,
          )

          // 上报慢资源
          this.reportCallback?.({
            type: 'slow-resource',
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now(),
          } as any)
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType('paint')
    const fpEntry = paintEntries.find(entry => entry.name === 'first-paint')
    return fpEntry ? fpEntry.startTime : 0
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find(
      entry => entry.name === 'first-contentful-paint',
    )
    return fcpEntry ? fcpEntry.startTime : 0
  }

  private reportMetric(name: string, value: number) {
    console.log(`[Performance] ${name}: ${value.toFixed(2)}`)

    // 性能阈值检查
    const thresholds = {
      CLS: 0.1, // 好: < 0.1, 需要改进: 0.1-0.25, 差: > 0.25
      FID: 100, // 好: < 100ms, 需要改进: 100-300ms, 差: > 300ms
      LCP: 2500, // 好: < 2.5s, 需要改进: 2.5-4s, 差: > 4s
      FCP: 1800, // 好: < 1.8s, 需要改进: 1.8-3s, 差: > 3s
      TTFB: 800, // 好: < 0.8s, 需要改进: 0.8-1.8s, 差: > 1.8s
    }

    const threshold = thresholds[name as keyof typeof thresholds]
    if (threshold && value > threshold) {
      console.warn(
        `[Performance Warning] ${name} 超出建议阈值: ${value} > ${threshold}`,
      )
    }
  }

  // 获取当前性能指标
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics }
  }

  // 手动上报性能指标
  reportToAnalytics() {
    if (this.reportCallback) {
      this.reportCallback(this.metrics as PerformanceMetrics)
    }
  }
}

export { PerformanceMonitor }
```

#### 错误监控系统

```typescript
// src/utils/error-tracking.ts
export interface ErrorInfo {
  message: string
  stack?: string
  url: string
  line?: number
  column?: number
  timestamp: number
  userAgent: string
  userId?: string
  additionalInfo?: Record<string, any>
}

export interface VueErrorInfo extends ErrorInfo {
  componentName?: string
  propsData?: any
  lifecycle?: string
}

class ErrorTracker {
  private errors: ErrorInfo[] = []
  private maxErrors = 100

  constructor(private reportCallback?: (error: ErrorInfo) => void) {
    this.initGlobalErrorHandling()
    this.initUnhandledPromiseRejection()
    this.initResourceErrorHandling()
  }

  // 全局错误捕获
  private initGlobalErrorHandling() {
    window.addEventListener('error', event => {
      const errorInfo: ErrorInfo = {
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        line: event.lineno,
        column: event.colno,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      }

      this.handleError(errorInfo)
    })
  }

  // Promise rejection 捕获
  private initUnhandledPromiseRejection() {
    window.addEventListener('unhandledrejection', event => {
      const errorInfo: ErrorInfo = {
        message:
          event.reason?.message ||
          event.reason?.toString() ||
          'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        additionalInfo: {
          type: 'unhandledrejection',
          reason: event.reason,
        },
      }

      this.handleError(errorInfo)
    })
  }

  // 资源加载错误捕获
  private initResourceErrorHandling() {
    window.addEventListener(
      'error',
      event => {
        if (event.target !== window) {
          const target = event.target as HTMLElement
          const errorInfo: ErrorInfo = {
            message: `Resource load error: ${target.tagName}`,
            url:
              (target as any).src ||
              (target as any).href ||
              window.location.href,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            additionalInfo: {
              type: 'resource-error',
              tagName: target.tagName,
              outerHTML: target.outerHTML.substring(0, 200),
            },
          }

          this.handleError(errorInfo)
        }
      },
      true,
    ) // 使用捕获阶段
  }

  // Vue 错误处理器
  setupVueErrorHandler(app: any) {
    app.config.errorHandler = (err: Error, instance: any, info: string) => {
      const errorInfo: VueErrorInfo = {
        message: err.message,
        stack: err.stack,
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        componentName: instance?.$options?.name || instance?.$options?.__name,
        propsData: instance?.$props,
        lifecycle: info,
        additionalInfo: {
          type: 'vue-error',
          info,
        },
      }

      this.handleError(errorInfo)
    }
  }

  private handleError(errorInfo: ErrorInfo) {
    // 添加到本地错误队列
    this.errors.push(errorInfo)

    // 保持队列大小
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    // 控制台输出
    console.error('[ErrorTracker]', errorInfo)

    // 上报错误
    this.reportCallback?.(errorInfo)

    // 本地存储错误信息（用于离线时的错误收集）
    this.saveErrorToStorage(errorInfo)
  }

  private saveErrorToStorage(errorInfo: ErrorInfo) {
    try {
      const storageKey = 'vue-blog-errors'
      const storedErrors = JSON.parse(localStorage.getItem(storageKey) || '[]')
      storedErrors.push(errorInfo)

      // 只保留最近50个错误
      if (storedErrors.length > 50) {
        storedErrors.splice(0, storedErrors.length - 50)
      }

      localStorage.setItem(storageKey, JSON.stringify(storedErrors))
    } catch (e) {
      console.warn('Failed to save error to localStorage:', e)
    }
  }

  // 手动上报错误
  reportError(error: Error, additionalInfo?: Record<string, any>) {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      additionalInfo,
    }

    this.handleError(errorInfo)
  }

  // 获取错误统计
  getErrorStats() {
    const stats = {
      totalErrors: this.errors.length,
      errorTypes: {} as Record<string, number>,
      recentErrors: this.errors.slice(-10),
    }

    this.errors.forEach(error => {
      const type = error.additionalInfo?.type || 'unknown'
      stats.errorTypes[type] = (stats.errorTypes[type] || 0) + 1
    })

    return stats
  }

  // 清除错误记录
  clearErrors() {
    this.errors = []
    localStorage.removeItem('vue-blog-errors')
  }
}

export { ErrorTracker }
```

### 应用性能优化

#### 组件性能优化

```vue
<!-- src/components/optimized/OptimizedArticleList.vue -->
<template>
  <div class="article-list" ref="containerRef">
    <!-- 虚拟滚动实现 -->
    <RecycleScroller
      v-if="useVirtualScroll && articles.length > 50"
      class="scroller"
      :items="articles"
      :item-size="itemHeight"
      key-field="id"
      v-slot="{ item, index }"
    >
      <ArticleCard
        :key="item.id"
        :article="item"
        :lazy="index > 10"
        @click="handleArticleClick"
      />
    </RecycleScroller>

    <!-- 普通列表 -->
    <template v-else>
      <ArticleCard
        v-for="(article, index) in articles"
        :key="article.id"
        :article="article"
        :lazy="index > 10"
        @click="handleArticleClick"
      />
    </template>

    <!-- 加载更多 -->
    <InfiniteLoading v-if="hasMore" @infinite="loadMore">
      <template #spinner>
        <div class="loading-spinner">加载中...</div>
      </template>
      <template #no-more>
        <div class="no-more">没有更多文章了</div>
      </template>
    </InfiniteLoading>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import { useArticlesStore } from '@/stores/articles'
import { useIntersectionObserver } from '@vueuse/core'
import ArticleCard from './ArticleCard.vue'
import InfiniteLoading from './InfiniteLoading.vue'

interface Props {
  useVirtualScroll?: boolean
  itemHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  useVirtualScroll: true,
  itemHeight: 200,
})

const articlesStore = useArticlesStore()
const containerRef = ref<HTMLElement>()

// 性能优化：使用计算属性缓存
const articles = computed(() => articlesStore.publishedArticles)
const hasMore = computed(
  () => articlesStore.pagination.page < articlesStore.pagination.totalPages,
)

// 性能监控
const loadStartTime = ref(0)
const renderTime = ref(0)

const handleArticleClick = (article: any) => {
  // 预加载文章详情
  articlesStore.preloadArticle(article.id)
}

const loadMore = async () => {
  loadStartTime.value = performance.now()

  try {
    await articlesStore.fetchArticles({
      page: articlesStore.pagination.page + 1,
    })

    renderTime.value = performance.now() - loadStartTime.value
    console.log(`加载更多耗时: ${renderTime.value.toFixed(2)}ms`)
  } catch (error) {
    console.error('加载更多失败:', error)
  }
}

// 预加载优化
const { stop } = useIntersectionObserver(
  containerRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasMore.value) {
      // 当容器进入视口时预加载下一页
      loadMore()
    }
  },
  {
    rootMargin: '100px',
  },
)

onBeforeUnmount(() => {
  stop()
})
</script>

<style scoped>
.article-list {
  min-height: 400px;
}

.scroller {
  height: 100%;
}

.loading-spinner,
.no-more {
  @apply text-center py-4 text-gray-500;
}
</style>
```

## 🛠️ 实践操作

### 步骤1：设置性能监控

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { PerformanceMonitor, ErrorTracker } from '@/utils/monitoring'
import { trpc } from '@/trpc/client'

const app = createApp(App)

// 初始化性能监控
const performanceMonitor = new PerformanceMonitor(metrics => {
  // 上报到后端分析服务
  trpc.analytics.reportPerformance.mutate(metrics).catch(console.error)
})

// 初始化错误追踪
const errorTracker = new ErrorTracker(error => {
  // 上报错误到监控服务
  trpc.analytics.reportError.mutate(error).catch(console.error)
})

// 设置 Vue 错误处理
errorTracker.setupVueErrorHandler(app)

// 页面可见性变化时上报性能数据
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    performanceMonitor.reportToAnalytics()
  }
})

app.mount('#app')
```

### 步骤2：实现代码分割

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { lazyRoutes } from './lazy-loading'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: lazyRoutes.Home,
    meta: { preload: true }, // 首页预加载
  },
  {
    path: '/articles',
    name: 'Articles',
    component: lazyRoutes.Articles,
  },
  {
    path: '/articles/:id',
    name: 'ArticleDetail',
    component: lazyRoutes.ArticleDetail,
    props: true,
  },
  {
    path: '/editor',
    name: 'Editor',
    component: lazyRoutes.Editor,
    meta: {
      requiresAuth: true,
      preload: false, // 编辑器按需加载
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由预加载
router.beforeEach(async (to, from, next) => {
  // 预加载下一个可能访问的路由
  if (to.meta?.preload) {
    const componentLoader = to.matched[0]?.components?.default as any
    if (typeof componentLoader === 'function') {
      componentLoader().catch(() => {
        // 预加载失败不影响正常导航
      })
    }
  }

  next()
})

export default router
```

### 步骤3：优化资源加载

```typescript
// src/utils/resource-optimization.ts
export class ResourceOptimizer {
  private imageCache = new Map<string, HTMLImageElement>()
  private preloadedScripts = new Set<string>()

  // 图片懒加载和预加载
  lazyLoadImages() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            const src = img.dataset.src

            if (src) {
              img.src = src
              img.removeAttribute('data-src')
              imageObserver.unobserve(img)
            }
          }
        })
      })

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img)
      })
    }
  }

  // 预加载关键资源
  preloadCriticalResources() {
    const criticalImages = ['/images/logo.svg', '/images/default-avatar.png']

    const criticalScripts = ['/js/vendor.js', '/js/common.js']

    // 预加载图片
    criticalImages.forEach(src => this.preloadImage(src))

    // 预加载脚本
    criticalScripts.forEach(src => this.preloadScript(src))
  }

  private preloadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) {
      return Promise.resolve(this.imageCache.get(src)!)
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.imageCache.set(src, img)
        resolve(img)
      }
      img.onerror = reject
      img.src = src
    })
  }

  private preloadScript(src: string): Promise<void> {
    if (this.preloadedScripts.has(src)) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'script'
      link.href = src
      link.onload = () => {
        this.preloadedScripts.add(src)
        resolve()
      }
      link.onerror = reject
      document.head.appendChild(link)
    })
  }

  // Service Worker 缓存策略
  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker 注册成功:', registration)
        })
        .catch(error => {
          console.log('ServiceWorker 注册失败:', error)
        })
    }
  }
}
```

## 🔍 深入思考

### 性能优化的系统性方法

1. **测量优先**：没有测量就没有优化
2. **渐进式优化**：先解决影响最大的性能瓶颈
3. **用户体验导向**：优化用户感知的性能，而不仅仅是技术指标
4. **持续监控**：建立长期的性能监控机制

### 前端性能优化检查清单

```typescript
// 性能优化清单
const PerformanceChecklist = {
  // 加载性能
  loading: {
    bundleSize: '< 250KB gzipped',
    initialJS: '< 150KB',
    images: 'WebP + 响应式',
    fonts: '字体预加载',
    criticalCSS: '内联关键CSS',
  },

  // 运行时性能
  runtime: {
    FCP: '< 1.8s',
    LCP: '< 2.5s',
    CLS: '< 0.1',
    FID: '< 100ms',
    memoryLeaks: '无内存泄漏',
  },

  // 用户体验
  UX: {
    loading: '加载状态提示',
    skeleton: '骨架屏',
    lazyLoad: '图片懒加载',
    infiniteScroll: '无限滚动',
    errorBoundary: '错误边界',
  },
}
```

## ❓ 遇到的问题

### 问题 1：构建产物过大

**问题描述**：生产环境构建后 JavaScript 包体积超过 500KB  
**解决方案**：

```typescript
// 1. 分析构建产物
npm run build:analyze

// 2. 代码分割优化
const routes = [
  {
    path: '/editor',
    component: () => import(/* webpackChunkName: "editor" */ '@/views/Editor.vue')
  }
]

// 3. 外部依赖 CDN 化
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['vue', 'element-plus'],
      output: {
        globals: {
          vue: 'Vue',
          'element-plus': 'ElementPlus'
        }
      }
    }
  }
})
```

### 问题 2：首屏加载慢

**问题描述**：首次访问页面 FCP 时间超过 3 秒  
**解决方案**：

```typescript
// 1. 关键资源预加载
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/js/vendor.js" as="script">

// 2. SSR 或 SSG
// 使用 Nuxt.js 或 Vite SSR Plugin

// 3. 服务端性能优化
// HTTP/2 Push, Gzip 压缩, CDN 加速
```

### 问题 3：内存泄漏问题

**问题描述**：长时间使用应用后内存持续增长  
**解决方案**：

```typescript
// 1. 及时清理事件监听器
onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  observer.disconnect()
})

// 2. 避免闭包引用
const cleanup = () => {
  // 清理所有引用
  data.value = null
  callbacks.clear()
}

// 3. 使用 WeakMap 和 WeakSet
const cache = new WeakMap() // 自动垃圾回收
```

## 💡 个人心得

### 今天最大的收获

成功建立了完整的前端性能监控和优化体系，理解了现代前端应用性能优化的系统性方法。

### 性能优化的关键洞察

1. **数据驱动优化**：基于真实用户数据做优化决策
2. **用户感知优先**：优化用户能感知到的性能指标
3. **长期监控**：建立持续的性能监控机制
4. **渐进式优化**：分阶段实施优化策略

## 📋 行动清单

### 今日完成

- [x] 配置 Vite 高级构建优化，实现高效代码分割
- [x] 集成 Web Vitals 性能监控系统
- [x] 实现全面的错误追踪机制
- [x] 建立资源优化和缓存策略

### 明日预习

- [ ] 了解 PWA 技术和离线缓存策略
- [ ] 思考移动端适配和响应式设计
- [ ] 准备 SEO 优化和元数据管理

## 🔗 有用链接

- [Web Vitals](https://web.dev/vitals/)
- [Vite 构建优化](https://vitejs.dev/guide/build.html)
- [Vue 性能优化指南](https://vuejs.org/guide/best-practices/performance.html)
- [Lighthouse 性能审计](https://developers.google.com/web/tools/lighthouse)

---

**📝 明日重点**：实现 PWA 功能，优化移动端体验和离线访问。
