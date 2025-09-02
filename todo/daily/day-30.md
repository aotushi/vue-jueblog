# Day 30: 前端生产构建优化与缓存策略

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 优化 Vite 生产构建配置和资源分割
- [ ] 实现静态资源缓存策略和 CDN 优化
- [ ] 配置资源压缩和性能预算控制
- [ ] 建立构建产物分析和监控体系

## 📚 学习笔记

### 现代前端构建优化策略

#### 资源分割和懒加载架构

```typescript
// vite.config.ts - 高级构建优化配置
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { splitVendorChunkPlugin } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { compression } from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    vue(),
    splitVendorChunkPlugin(), // 自动分离第三方库
    compression({
      // Gzip 压缩
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
    compression({
      // Brotli 压缩
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
    visualizer({
      // 构建分析
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false, // 生产环境关闭源码映射
    minify: 'esbuild',

    rollupOptions: {
      output: {
        // 细粒度的资源分块策略
        manualChunks: {
          // 框架核心库
          'vue-vendor': ['vue', 'vue-router', 'pinia'],

          // UI 组件库
          'ui-vendor': ['@headlessui/vue', '@heroicons/vue'],

          // 工具库
          'utils-vendor': ['date-fns', 'lodash-es', 'validator'],

          // 富文本编辑器 (较大的库单独分包)
          editor: ['@tiptap/vue-3', '@tiptap/starter-kit'],

          // 图表和可视化 (按需分包)
          charts: ['echarts', 'vue-echarts'],

          // 国际化相关
          i18n: ['vue-i18n'],
        },

        // 文件命名策略
        chunkFileNames: chunkInfo => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            // 根据文件路径生成语义化名称
            const fileName = facadeModuleId
              .split('/')
              .pop()
              ?.replace('.vue', '')
            return `assets/chunks/[name]-${fileName}-[hash].js`
          }
          return 'assets/chunks/[name]-[hash].js'
        },

        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: assetInfo => {
          const info = assetInfo.name!.split('.')
          const ext = info[info.length - 1]

          // 根据文件类型分目录存放
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/.test(assetInfo.name!)) {
            return `assets/media/[name]-[hash].${ext}`
          }
          if (/\.(png|jpe?g|gif|svg|ico|webp)$/.test(assetInfo.name!)) {
            return `assets/images/[name]-[hash].${ext}`
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name!)) {
            return `assets/fonts/[name]-[hash].${ext}`
          }
          return `assets/[ext]/[name]-[hash].${ext}`
        },
      },
    },

    // 性能预算配置
    chunkSizeWarningLimit: 500, // 单个 chunk 大小警告阈值 (KB)
    assetsInlineLimit: 4096, // 小于 4KB 的资源内联为 base64
  },

  // 开发服务器优化
  server: {
    fs: {
      // 提升开发体验的文件系统访问优化
      cachedChecks: false,
    },
  },

  // 依赖预构建优化
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@vueuse/core',
      'date-fns',
      'lodash-es',
    ],
    exclude: [
      // 排除大型库避免预构建影响启动速度
      '@tiptap/vue-3',
      'echarts',
    ],
  },
})
```

#### 智能缓存策略设计

```typescript
// src/utils/cache-strategy.ts
export enum CacheStrategy {
  // 立即失效 - 对于关键业务数据
  IMMEDIATE = 'no-cache',

  // 短期缓存 - 对于频繁变化的数据
  SHORT_TERM = 'max-age=300', // 5分钟

  // 中期缓存 - 对于相对稳定的数据
  MEDIUM_TERM = 'max-age=3600', // 1小时

  // 长期缓存 - 对于静态资源
  LONG_TERM = 'max-age=31536000', // 1年

  // 协商缓存 - 对于可能更新的内容
  REVALIDATE = 'max-age=0, must-revalidate',
}

// 资源缓存配置映射
export const RESOURCE_CACHE_CONFIG = {
  // HTML 页面 - 使用协商缓存
  '*.html': CacheStrategy.REVALIDATE,

  // JavaScript 和 CSS - 长期缓存 + 版本哈希
  '*.js': CacheStrategy.LONG_TERM,
  '*.css': CacheStrategy.LONG_TERM,
  '*.mjs': CacheStrategy.LONG_TERM,

  // 图片资源 - 长期缓存
  '*.{png,jpg,jpeg,gif,webp,svg,ico}': CacheStrategy.LONG_TERM,

  // 字体文件 - 长期缓存
  '*.{woff,woff2,eot,ttf,otf}': CacheStrategy.LONG_TERM,

  // 媒体文件 - 长期缓存
  '*.{mp4,webm,ogg,mp3,wav}': CacheStrategy.LONG_TERM,

  // API 数据 - 根据具体业务设置
  '/api/articles': CacheStrategy.SHORT_TERM,
  '/api/users': CacheStrategy.MEDIUM_TERM,
  '/api/auth': CacheStrategy.IMMEDIATE,

  // Manifest 和服务工作者 - 立即失效
  'manifest.json': CacheStrategy.IMMEDIATE,
  'sw.js': CacheStrategy.IMMEDIATE,
}

// Cloudflare Pages 缓存头部配置
export const generateCacheHeaders = (filePath: string): string => {
  for (const [pattern, strategy] of Object.entries(RESOURCE_CACHE_CONFIG)) {
    if (minimatch(filePath, pattern)) {
      return strategy
    }
  }

  // 默认缓存策略
  return CacheStrategy.SHORT_TERM
}
```

### 静态资源优化

#### 图像优化和自适应加载

```typescript
// src/components/optimized/OptimizedImage.vue
<template>
  <div class="optimized-image-container">
    <!-- 渐进式加载容器 -->
    <div
      class="image-placeholder"
      :class="{ loaded: imageLoaded }"
      :style="{ aspectRatio: `${aspectRatio}` }"
    >
      <!-- 占位符 (低质量版本) -->
      <img
        v-if="placeholder"
        :src="placeholder"
        :alt="alt"
        class="placeholder-image"
        loading="lazy"
      />

      <!-- 主图像 (支持 WebP/AVIF) -->
      <picture class="main-image" v-if="!error">
        <!-- 现代格式支持 -->
        <source
          v-if="avifSrc"
          :srcset="generateSrcSet(avifSrc, 'avif')"
          :sizes="sizes"
          type="image/avif"
        />
        <source
          v-if="webpSrc"
          :srcset="generateSrcSet(webpSrc, 'webp')"
          :sizes="sizes"
          type="image/webp"
        />

        <!-- 回退格式 -->
        <img
          :src="src"
          :srcset="generateSrcSet(src)"
          :sizes="sizes"
          :alt="alt"
          :loading="loading"
          :decoding="decoding"
          class="responsive-image"
          @load="handleImageLoad"
          @error="handleImageError"
        />
      </picture>

      <!-- 错误状态 -->
      <div v-if="error" class="image-error">
        <Icon name="image-broken" />
        <p>图片加载失败</p>
      </div>

      <!-- 加载状态 -->
      <div v-if="!imageLoaded && !error" class="loading-spinner">
        <div class="spinner"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

interface Props {
  src: string
  alt: string
  width?: number
  height?: number
  placeholder?: string
  webpSrc?: string
  avifSrc?: string
  sizes?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'sync' | 'async' | 'auto'
  quality?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: 'lazy',
  decoding: 'async',
  quality: 85,
  sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
})

const imageLoaded = ref(false)
const error = ref(false)
const containerRef = ref<HTMLElement>()

// 计算宽高比
const aspectRatio = computed(() => {
  if (props.width && props.height) {
    return `${props.width} / ${props.height}`
  }
  return '16 / 9' // 默认比例
})

// 生成响应式 srcset
const generateSrcSet = (baseSrc: string, format?: string) => {
  const breakpoints = [320, 640, 768, 1024, 1280, 1920]
  const extension = format || baseSrc.split('.').pop()
  const baseName = baseSrc.replace(/\.[^/.]+$/, '')

  return breakpoints
    .map(width => {
      const optimizedUrl = `${baseName}_${width}w.${extension}`
      return `${optimizedUrl} ${width}w`
    })
    .join(', ')
}

// 交叉观察器 - 可视区域内才开始加载
const { stop } = useIntersectionObserver(
  containerRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      // 进入可视区域，开始加载图片
      stop()
    }
  },
  { threshold: 0.1 }
)

const handleImageLoad = () => {
  imageLoaded.value = true
}

const handleImageError = () => {
  error.value = true
  console.error(`图片加载失败: ${props.src}`)
}
</script>

<style scoped>
.optimized-image-container {
  width: 100%;
  position: relative;
}

.image-placeholder {
  position: relative;
  overflow: hidden;
  background: #f3f4f6;
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.placeholder-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(10px);
  transform: scale(1.1);
  transition: opacity 0.3s ease;
}

.main-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.responsive-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.loaded .responsive-image {
  opacity: 1;
}

.loaded .placeholder-image {
  opacity: 0;
}

.image-error {
  @apply absolute inset-0 flex flex-col items-center justify-center
         text-gray-400 bg-gray-100;
}

.loading-spinner {
  @apply absolute inset-0 flex items-center justify-center;
}

.spinner {
  @apply w-8 h-8 border-2 border-gray-300 border-t-blue-500
         rounded-full animate-spin;
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .image-placeholder {
    background: #374151;
  }

  .image-error {
    @apply bg-gray-800 text-gray-400;
  }
}

/* 减少动画支持 */
@media (prefers-reduced-motion: reduce) {
  .placeholder-image,
  .responsive-image {
    transition: none;
  }

  .spinner {
    animation: none;
  }
}
</style>
```

#### 字体优化策略

```typescript
// src/styles/font-optimization.css
/* 字体显示优化 - 防止布局偏移 */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap; /* 使用系统字体直到自定义字体加载完成 */
  src: url('/fonts/inter-variable.woff2') format('woff2-variations');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* 中文字体优化 */
@font-face {
  font-family: 'Noto Sans SC';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/noto-sans-sc-variable.woff2') format('woff2-variations');
  unicode-range: U+4E00-9FFF, U+3400-4DBF, U+20000-2A6DF, U+F900-FAFF, U+2F800-2FA1F;
}

/* 字体加载优化 */
.font-loading {
  font-family: system-ui, -apple-system, sans-serif; /* 系统字体作为回退 */
}

.font-loaded {
  font-family: 'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
}

/* 字体性能优化 */
body {
  /* 启用硬件加速 */
  transform: translateZ(0);
  backface-visibility: hidden;

  /* 文本渲染优化 */
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* 字体特性支持 */
  font-feature-settings:
    "liga" 1,    /* 连字 */
    "kern" 1,    /* 字距调整 */
    "calt" 1;    /* 上下文替换 */
}
```

### 构建性能监控

#### 构建分析和优化

```typescript
// scripts/build-analyzer.ts
import fs from 'fs'
import path from 'path'
import { gzipSync, brotliCompressSync } from 'zlib'
import chalk from 'chalk'

interface BuildAnalysis {
  totalSize: number
  gzipSize: number
  brotliSize: number
  chunks: ChunkInfo[]
  assets: AssetInfo[]
  warnings: string[]
}

interface ChunkInfo {
  name: string
  size: number
  gzipSize: number
  brotliSize: number
  modules: string[]
}

interface AssetInfo {
  name: string
  size: number
  type: 'js' | 'css' | 'image' | 'font' | 'other'
}

class BuildAnalyzer {
  private distPath: string
  private analysis: BuildAnalysis

  constructor(distPath: string = 'dist') {
    this.distPath = distPath
    this.analysis = {
      totalSize: 0,
      gzipSize: 0,
      brotliSize: 0,
      chunks: [],
      assets: [],
      warnings: [],
    }
  }

  async analyze(): Promise<BuildAnalysis> {
    console.log(chalk.blue('🔍 开始构建分析...'))

    const files = this.getAllFiles(this.distPath)

    for (const file of files) {
      const filePath = path.join(this.distPath, file)
      const content = fs.readFileSync(filePath)
      const size = content.length

      // 计算压缩大小
      const gzipSize = gzipSync(content).length
      const brotliSize = brotliCompressSync(content).length

      this.analysis.totalSize += size
      this.analysis.gzipSize += gzipSize
      this.analysis.brotliSize += brotliSize

      // 分类文件类型
      const asset: AssetInfo = {
        name: file,
        size,
        type: this.getAssetType(file),
      }

      this.analysis.assets.push(asset)

      // 检查大小警告
      this.checkSizeWarnings(asset)
    }

    // 按大小排序
    this.analysis.assets.sort((a, b) => b.size - a.size)

    // 生成报告
    this.generateReport()

    return this.analysis
  }

  private getAllFiles(
    dir: string,
    files: string[] = [],
    baseDir = '',
  ): string[] {
    const items = fs.readdirSync(dir)

    for (const item of items) {
      const fullPath = path.join(dir, item)
      const relativePath = path.join(baseDir, item)

      if (fs.statSync(fullPath).isDirectory()) {
        this.getAllFiles(fullPath, files, relativePath)
      } else {
        files.push(relativePath)
      }
    }

    return files
  }

  private getAssetType(filename: string): AssetInfo['type'] {
    const ext = path.extname(filename).toLowerCase()

    if (['.js', '.mjs', '.ts'].includes(ext)) return 'js'
    if (['.css', '.scss', '.less'].includes(ext)) return 'css'
    if (
      ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)
    )
      return 'image'
    if (['.woff', '.woff2', '.eot', '.ttf', '.otf'].includes(ext)) return 'font'

    return 'other'
  }

  private checkSizeWarnings(asset: AssetInfo) {
    const sizeKB = asset.size / 1024

    // JavaScript 文件大小检查
    if (asset.type === 'js' && sizeKB > 500) {
      this.analysis.warnings.push(
        `⚠️  大型 JS 文件: ${asset.name} (${sizeKB.toFixed(1)}KB)`,
      )
    }

    // CSS 文件大小检查
    if (asset.type === 'css' && sizeKB > 100) {
      this.analysis.warnings.push(
        `⚠️  大型 CSS 文件: ${asset.name} (${sizeKB.toFixed(1)}KB)`,
      )
    }

    // 图片文件大小检查
    if (asset.type === 'image' && sizeKB > 200) {
      this.analysis.warnings.push(
        `⚠️  大型图片文件: ${asset.name} (${sizeKB.toFixed(1)}KB)`,
      )
    }
  }

  private generateReport() {
    console.log('\n' + chalk.green('📊 构建分析报告'))
    console.log(chalk.blue('='.repeat(50)))

    // 总体统计
    console.log(chalk.yellow('📈 总体统计:'))
    console.log(`原始大小: ${this.formatSize(this.analysis.totalSize)}`)
    console.log(
      `Gzip 压缩: ${this.formatSize(this.analysis.gzipSize)} (压缩率: ${this.getCompressionRatio(this.analysis.totalSize, this.analysis.gzipSize)})`,
    )
    console.log(
      `Brotli 压缩: ${this.formatSize(this.analysis.brotliSize)} (压缩率: ${this.getCompressionRatio(this.analysis.totalSize, this.analysis.brotliSize)})`,
    )

    // 文件类型统计
    console.log('\n' + chalk.yellow('📁 文件类型统计:'))
    const typeStats = this.getTypeStatistics()
    for (const [type, stats] of Object.entries(typeStats)) {
      console.log(
        `${type}: ${stats.count} 个文件, ${this.formatSize(stats.size)}`,
      )
    }

    // 最大文件
    console.log('\n' + chalk.yellow('📄 最大的10个文件:'))
    this.analysis.assets.slice(0, 10).forEach((asset, index) => {
      const indicator =
        asset.size > 100 * 1024 ? '🔴' : asset.size > 50 * 1024 ? '🟡' : '🟢'
      console.log(
        `${index + 1}. ${indicator} ${asset.name} (${this.formatSize(asset.size)})`,
      )
    })

    // 警告信息
    if (this.analysis.warnings.length > 0) {
      console.log('\n' + chalk.red('⚠️  性能警告:'))
      this.analysis.warnings.forEach(warning => console.log(warning))
    }

    // 优化建议
    console.log('\n' + chalk.cyan('💡 优化建议:'))
    this.generateOptimizationTips()
  }

  private getTypeStatistics() {
    const stats: Record<string, { count: number; size: number }> = {}

    for (const asset of this.analysis.assets) {
      if (!stats[asset.type]) {
        stats[asset.type] = { count: 0, size: 0 }
      }
      stats[asset.type].count++
      stats[asset.type].size += asset.size
    }

    return stats
  }

  private generateOptimizationTips() {
    const tips = []

    // JavaScript 优化建议
    const jsAssets = this.analysis.assets.filter(a => a.type === 'js')
    const totalJsSize = jsAssets.reduce((sum, asset) => sum + asset.size, 0)
    if (totalJsSize > 500 * 1024) {
      tips.push('考虑进一步拆分 JavaScript 包，使用动态导入')
    }

    // CSS 优化建议
    const cssAssets = this.analysis.assets.filter(a => a.type === 'css')
    if (cssAssets.length > 1) {
      tips.push('考虑合并小的 CSS 文件以减少 HTTP 请求')
    }

    // 图片优化建议
    const imageAssets = this.analysis.assets.filter(a => a.type === 'image')
    const largeImages = imageAssets.filter(a => a.size > 100 * 1024)
    if (largeImages.length > 0) {
      tips.push('考虑压缩大型图片或使用现代格式 (WebP, AVIF)')
    }

    // 字体优化建议
    const fontAssets = this.analysis.assets.filter(a => a.type === 'font')
    if (
      fontAssets.some(a => a.name.includes('.ttf') || a.name.includes('.otf'))
    ) {
      tips.push('使用 WOFF2 格式字体以获得更好的压缩率')
    }

    tips.forEach(tip => console.log(`• ${tip}`))
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  private getCompressionRatio(original: number, compressed: number): string {
    const ratio = (((original - compressed) / original) * 100).toFixed(1)
    return `${ratio}%`
  }
}

// 执行构建分析
if (require.main === module) {
  const analyzer = new BuildAnalyzer()
  analyzer.analyze().catch(console.error)
}

export { BuildAnalyzer }
```

## 🛠️ 实践操作

### 步骤1：配置高级构建优化

```bash
# 安装构建优化依赖
npm install -D vite-plugin-compression rollup-plugin-visualizer
npm install -D @rollup/plugin-terser vite-plugin-eslint
```

```typescript
// vite.config.ts 完整配置
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      // 其他插件配置...
    ],

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    build: {
      // 详细的构建配置
    },

    // 环境变量配置
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  }
})
```

### 步骤2：实现资源预加载策略

```vue
<!-- src/components/ResourcePreloader.vue -->
<template>
  <Teleport to="head">
    <!-- DNS 预解析 -->
    <link rel="dns-prefetch" :href="apiDomain" />
    <link rel="dns-prefetch" href="//fonts.googleapis.com" />

    <!-- 关键资源预加载 -->
    <link
      v-for="resource in criticalResources"
      :key="resource.href"
      rel="preload"
      :href="resource.href"
      :as="resource.as"
      :type="resource.type"
      :crossorigin="resource.crossorigin"
    />

    <!-- 下个页面资源预取 -->
    <link
      v-for="resource in prefetchResources"
      :key="resource.href"
      rel="prefetch"
      :href="resource.href"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 关键资源配置
const criticalResources = computed(() => [
  {
    href: '/fonts/inter-variable.woff2',
    as: 'font',
    type: 'font/woff2',
    crossorigin: 'anonymous',
  },
  {
    href: '/css/critical.css',
    as: 'style',
  },
])

// 根据当前页面预取可能访问的资源
const prefetchResources = computed(() => {
  const resources = []

  if (route.name === 'Home') {
    resources.push(
      { href: '/js/chunks/articles-page.js' },
      { href: '/api/articles?limit=10' },
    )
  }

  if (route.name === 'ArticleList') {
    resources.push({ href: '/js/chunks/article-detail.js' })
  }

  return resources
})

const apiDomain = import.meta.env.VITE_API_BASE_URL
</script>
```

### 步骤3：建立性能监控体系

```typescript
// src/utils/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map()
  private observer?: PerformanceObserver

  constructor() {
    this.initializeObservers()
    this.collectWebVitals()
  }

  private initializeObservers() {
    // 长任务监控
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.recordMetric('long_task_duration', entry.duration)
            console.warn('长任务检测:', entry)
          }

          if (entry.entryType === 'largest-contentful-paint') {
            this.recordMetric('lcp', entry.startTime)
          }

          if (entry.entryType === 'first-input') {
            this.recordMetric(
              'fid',
              (entry as any).processingStart - entry.startTime,
            )
          }
        }
      })

      try {
        this.observer.observe({
          entryTypes: ['longtask', 'largest-contentful-paint', 'first-input'],
        })
      } catch (e) {
        console.warn('Performance Observer 不支持某些指标:', e)
      }
    }
  }

  private collectWebVitals() {
    // CLS 监控
    let clsValue = 0
    let clsEntries: PerformanceEntry[] = []

    const observer = new PerformanceObserver(entryList => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
          clsEntries.push(entry)
        }
      }
    })

    try {
      observer.observe({ type: 'layout-shift', buffered: true })
    } catch (e) {
      console.warn('CLS 监控不可用:', e)
    }

    // 页面卸载时记录 CLS
    addEventListener('beforeunload', () => {
      this.recordMetric('cls', clsValue)
    })
  }

  recordMetric(name: string, value: number) {
    this.metrics.set(name, value)

    // 发送到分析服务
    if (import.meta.env.PROD) {
      this.sendToAnalytics(name, value)
    }
  }

  private async sendToAnalytics(metric: string, value: number) {
    try {
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metric,
          value,
          timestamp: Date.now(),
          url: window.location.pathname,
          userAgent: navigator.userAgent,
        }),
      })
    } catch (error) {
      console.warn('性能数据发送失败:', error)
    }
  }

  getMetrics() {
    return Object.fromEntries(this.metrics)
  }

  // 资源加载时间监控
  trackResourceLoading() {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming

          // 记录慢加载的资源
          if (resource.duration > 1000) {
            console.warn('慢资源:', resource.name, `${resource.duration}ms`)
            this.recordMetric('slow_resource_count', 1)
          }
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor()
```

## 🔍 深入思考

### 构建优化的关键原则

1. **资源分割策略**

   - 按业务模块分包
   - 第三方库单独打包
   - 公共代码提取复用

2. **缓存优化**

   - 版本哈希确保缓存更新
   - 分层缓存策略
   - HTTP/2 多路复用优化

3. **加载性能**
   - 关键路径优先加载
   - 非关键资源延迟加载
   - 渐进式增强体验

### 性能预算管理

```typescript
// 性能预算配置
const PERFORMANCE_BUDGETS = {
  // 文件大小预算 (KB)
  maxBundleSize: 500,
  maxChunkSize: 250,
  maxImageSize: 200,
  maxFontSize: 100,

  // 性能指标预算 (ms)
  maxLCP: 2500,
  maxFID: 100,
  maxCLS: 0.1,
  maxTTFB: 800,

  // 网络请求预算
  maxRequests: 50,
  maxDomainConnections: 6,
}
```

## ❓ 遇到的问题

### 问题 1：构建包体积过大

**问题描述**：生产构建后单个 JS 文件超过 1MB  
**解决方案**：

```typescript
// 实现更细粒度的代码分割
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 第三方库分包
          if (id.includes('node_modules')) {
            if (id.includes('vue')) return 'vue'
            if (id.includes('@tiptap')) return 'editor'
            if (id.includes('lodash')) return 'utils'
            return 'vendor'
          }

          // 业务代码分包
          if (id.includes('/views/')) {
            const segments = id.split('/')
            const viewName = segments[segments.indexOf('views') + 1]
            return `pages-${viewName}`
          }
        },
      },
    },
  },
})
```

### 问题 2：图片加载性能差

**问题描述**：大量图片导致页面加载缓慢  
**解决方案**：实现图片懒加载和格式优化策略

### 问题 3：字体加载闪烁

**问题描述**：自定义字体加载时出现文本闪烁  
**解决方案**：

```css
/* 使用 font-display: swap 策略 */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap; /* 立即显示回退字体 */
}
```

## 💡 个人心得

### 今天最大的收获

深入理解了现代前端构建优化的系统性思维，不仅是技术层面的优化，更是用户体验的全面提升。

### 性能优化的核心洞察

1. **用户感知优先**：优化用户可感知的性能指标
2. **渐进式加载**：按需加载，减少初始负担
3. **缓存策略**：合理的缓存能大幅提升回访性能
4. **监控驱动**：基于数据的优化决策更有效

## 📋 行动清单

### 今日完成

- [x] 配置高级 Vite 构建优化和资源分割
- [x] 实现智能缓存策略和资源预加载
- [x] 建立构建分析和性能监控体系
- [x] 优化图片和字体加载性能

### 明日预习

- [ ] 了解最终项目部署和上线流程
- [ ] 思考项目维护和更新策略
- [ ] 准备项目文档和使用指南

## 🔗 有用链接

- [Vite 构建优化指南](https://vitejs.dev/guide/build.html)
- [Web 性能优化最佳实践](https://web.dev/fast/)
- [现代图片优化技术](https://web.dev/fast/#optimize-your-images)
- [字体优化策略](https://web.dev/font-best-practices/)

---

**📝 明日重点**：完成最终项目部署，编写项目文档和总结。
