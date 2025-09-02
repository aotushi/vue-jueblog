# Day 18: 文件上传功能集成

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 集成 Cloudflare R2 存储服务
- [ ] 实现文件上传 tRPC procedures
- [ ] 处理图片压缩和格式转换
- [ ] 测试头像和文章图片上传

## 📚 学习笔记

### Cloudflare R2 存储服务

#### R2 vs 其他存储方案对比

```
传统方案 vs Cloudflare R2:

阿里云 OSS / AWS S3          Cloudflare R2
├── 存储费用: $0.023/GB/月    ├── 存储费用: $0.015/GB/月 (更便宜)
├── 流量费用: $0.09/GB        ├── 流量费用: $0 (免费出站流量!)
├── API调用: $0.0004/千次     ├── API调用: $0.0036/千次
├── 延迟: 50-200ms           ├── 延迟: 20-50ms (边缘加速)
└── 集成: 需要 SDK 配置       └── 集成: Workers 原生支持
```

#### R2 的核心优势

1. **零出站流量费用**：下载图片完全免费
2. **边缘加速**：全球 CDN 自动分发
3. **S3 兼容 API**：无缝迁移现有代码
4. **Workers 集成**：无需额外配置

### 文件上传架构设计

#### 上传流程设计

```
前端上传流程:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ 1. 选择文件  │───▶│ 2. 前端压缩   │───▶│ 3. 生成预览  │
└─────────────┘    └──────────────┘    └─────────────┘
                            │
                            ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ 6. 更新UI   │◀───│ 5. 返回URL    │◀───│ 4. 上传到R2  │
└─────────────┘    └──────────────┘    └─────────────┘
```

#### 文件存储策略

```
R2 存储结构:
vue-blog-storage/
├── avatars/                    # 用户头像
│   ├── {user-id}/
│   │   ├── original.jpg        # 原图
│   │   ├── small.jpg          # 小尺寸 (64x64)
│   │   └── medium.jpg         # 中尺寸 (200x200)
├── articles/                   # 文章图片
│   ├── {article-id}/
│   │   ├── cover.jpg          # 封面图
│   │   └── content/           # 内容图片
│   │       ├── img1.jpg
│   │       └── img2.png
└── temp/                      # 临时文件 (24小时清理)
    └── {upload-id}/
        └── {filename}
```

## 🛠️ 实践操作

### 步骤1：配置 Cloudflare R2

#### 在 wrangler.toml 中配置 R2

```toml
# wrangler.toml
name = "vue-blog-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# R2 存储桶配置
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vue-blog-storage"
```

#### 创建 R2 存储桶

```bash
# 创建 R2 存储桶
wrangler r2 bucket create vue-blog-storage

# 查看存储桶列表
wrangler r2 bucket list

# 设置 CORS 策略
wrangler r2 bucket cors put vue-blog-storage --file=cors.json
```

#### CORS 配置文件

```json
// cors.json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### 步骤2：实现文件上传 Procedures

```typescript
// src/trpc/uploads.ts
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from './router'
import { TRPCError } from '@trpc/server'

// 文件类型验证
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const FileUploadSchema = z.object({
  file: z.instanceof(File, { message: '请选择文件' }),
  type: z.enum(['avatar', 'article-cover', 'article-content'], {
    errorMap: () => ({ message: '无效的文件类型' }),
  }),
  articleId: z.string().uuid().optional(), // 文章图片时必需
})

export const uploadRouter = router({
  // 获取上传预签名 URL
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1, '文件名不能为空'),
        contentType: z.string().min(1, '文件类型不能为空'),
        size: z.number().max(MAX_FILE_SIZE, '文件大小不能超过5MB'),
        type: z.enum(['avatar', 'article-cover', 'article-content']),
        articleId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { filename, contentType, size, type, articleId } = input

      // 验证文件类型
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '只支持 JPEG、PNG、WebP、GIF 格式的图片',
        })
      }

      // 生成文件路径
      const userId = ctx.user.id
      const uploadId = crypto.randomUUID()
      const timestamp = Date.now()
      const extension = filename.split('.').pop()

      let filePath = ''
      switch (type) {
        case 'avatar':
          filePath = `avatars/${userId}/${timestamp}.${extension}`
          break
        case 'article-cover':
          if (!articleId)
            throw new TRPCError({ code: 'BAD_REQUEST', message: '文章ID必需' })
          filePath = `articles/${articleId}/cover.${extension}`
          break
        case 'article-content':
          if (!articleId)
            throw new TRPCError({ code: 'BAD_REQUEST', message: '文章ID必需' })
          filePath = `articles/${articleId}/content/${uploadId}.${extension}`
          break
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '无效的上传类型',
          })
      }

      // 生成预签名 URL (这里简化，实际应该生成真正的预签名 URL)
      const uploadUrl = `${ctx.env.R2_UPLOAD_ENDPOINT}/${filePath}`

      return {
        uploadUrl,
        filePath,
        uploadId,
        maxSize: MAX_FILE_SIZE,
      }
    }),

  // 直接上传文件 (使用 FormData)
  uploadFile: protectedProcedure
    .input(
      z.object({
        file: z.any(), // FormData 中的文件
        type: z.enum(['avatar', 'article-cover', 'article-content']),
        articleId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { file, type, articleId } = input

      // 验证文件
      if (!file || typeof file.arrayBuffer !== 'function') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '无效的文件',
        })
      }

      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '文件大小不能超过5MB',
        })
      }

      // 检查文件类型
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '只支持 JPEG、PNG、WebP、GIF 格式的图片',
        })
      }

      // 生成文件路径
      const userId = ctx.user.id
      const timestamp = Date.now()
      const extension = file.name.split('.').pop()

      let filePath = ''
      switch (type) {
        case 'avatar':
          // 删除旧头像
          await deleteOldAvatar(ctx.env.STORAGE, userId)
          filePath = `avatars/${userId}/avatar-${timestamp}.${extension}`
          break
        case 'article-cover':
          if (!articleId)
            throw new TRPCError({ code: 'BAD_REQUEST', message: '文章ID必需' })
          filePath = `articles/${articleId}/cover-${timestamp}.${extension}`
          break
        case 'article-content':
          if (!articleId)
            throw new TRPCError({ code: 'BAD_REQUEST', message: '文章ID必需' })
          const fileId = crypto.randomUUID()
          filePath = `articles/${articleId}/content/${fileId}.${extension}`
          break
      }

      try {
        // 上传到 R2
        const fileBuffer = await file.arrayBuffer()

        await ctx.env.STORAGE.put(filePath, fileBuffer, {
          httpMetadata: {
            contentType: file.type,
            cacheControl: 'public, max-age=31536000', // 缓存1年
          },
          customMetadata: {
            originalName: file.name,
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
          },
        })

        // 生成访问 URL
        const fileUrl = `https://storage.yourdomain.com/${filePath}`

        // 如果是头像，更新用户表
        if (type === 'avatar') {
          await ctx.env.DB.prepare(
            `
            UPDATE users SET avatar = ?, updated_at = datetime('now')
            WHERE id = ?
          `,
          )
            .bind(fileUrl, userId)
            .run()
        }

        return {
          url: fileUrl,
          filePath,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        }
      } catch (error) {
        console.error('文件上传失败:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '文件上传失败',
        })
      }
    }),

  // 删除文件
  deleteFile: protectedProcedure
    .input(
      z.object({
        filePath: z.string().min(1),
        type: z.enum(['avatar', 'article-cover', 'article-content']),
        articleId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { filePath, type, articleId } = input
      const userId = ctx.user.id

      // 权限验证
      if (type === 'avatar' && !filePath.startsWith(`avatars/${userId}/`)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '无权删除此文件',
        })
      }

      if (
        (type === 'article-cover' || type === 'article-content') &&
        articleId
      ) {
        // 验证文章所有权
        const article = await ctx.env.DB.prepare(
          `
          SELECT author_id FROM articles WHERE id = ?
        `,
        )
          .bind(articleId)
          .first()

        if (!article || article.author_id !== userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '无权删除此文件',
          })
        }
      }

      try {
        // 从 R2 删除文件
        await ctx.env.STORAGE.delete(filePath)

        return { message: '文件删除成功' }
      } catch (error) {
        console.error('文件删除失败:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '文件删除失败',
        })
      }
    }),

  // 获取文件信息
  getFileInfo: protectedProcedure
    .input(z.string().min(1))
    .query(async ({ input: filePath, ctx }) => {
      try {
        const object = await ctx.env.STORAGE.head(filePath)

        if (!object) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '文件不存在',
          })
        }

        return {
          size: object.size,
          lastModified: object.uploaded,
          contentType: object.httpMetadata?.contentType,
          metadata: object.customMetadata,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '文件不存在',
        })
      }
    }),
})

// 删除用户旧头像
async function deleteOldAvatar(storage: R2Bucket, userId: string) {
  try {
    const objects = await storage.list({
      prefix: `avatars/${userId}/`,
    })

    // 删除所有旧头像
    for (const object of objects.objects) {
      await storage.delete(object.key)
    }
  } catch (error) {
    console.warn('删除旧头像失败:', error)
  }
}
```

### 步骤3：前端文件上传组件

```vue
<!-- src/components/FileUpload.vue -->
<template>
  <div class="file-upload">
    <el-upload
      ref="uploadRef"
      :action="uploadAction"
      :before-upload="beforeUpload"
      :on-success="handleSuccess"
      :on-error="handleError"
      :show-file-list="showFileList"
      :accept="accept"
      :limit="limit"
      :disabled="uploading"
      v-bind="$attrs"
    >
      <slot name="trigger" :uploading="uploading">
        <el-button :loading="uploading" type="primary">
          {{ uploading ? '上传中...' : '选择文件' }}
        </el-button>
      </slot>

      <template #tip>
        <div class="el-upload__tip">
          支持 {{ acceptDesc }}，文件大小不超过 {{ maxSizeMB }}MB
        </div>
      </template>
    </el-upload>

    <!-- 图片预览 -->
    <div v-if="previewUrl && showPreview" class="preview">
      <img :src="previewUrl" alt="预览" />
      <el-button size="small" type="danger" @click="clearPreview">
        删除
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElUpload } from 'element-plus'
import { trpc } from '@/trpc/client'
import type { UploadInstance, UploadRawFile } from 'element-plus'

interface Props {
  type: 'avatar' | 'article-cover' | 'article-content'
  articleId?: string
  maxSize?: number // MB
  accept?: string
  showFileList?: boolean
  showPreview?: boolean
  limit?: number
}

interface Emits {
  (e: 'success', url: string): void
  (e: 'error', error: string): void
}

const props = withDefaults(defineProps<Props>(), {
  maxSize: 5,
  accept: 'image/*',
  showFileList: false,
  showPreview: true,
  limit: 1,
})

const emit = defineEmits<Emits>()

const uploadRef = ref<UploadInstance>()
const uploading = ref(false)
const previewUrl = ref('')

const maxSizeMB = computed(() => props.maxSize)
const maxSizeBytes = computed(() => props.maxSize * 1024 * 1024)
const acceptDesc = computed(() => {
  if (props.accept === 'image/*') return 'JPG、PNG、WebP、GIF'
  return props.accept.replace('image/', '').toUpperCase()
})

const uploadAction = computed(() => {
  // 这里返回一个占位URL，实际上传由 beforeUpload 处理
  return '#'
})

// 上传前验证
const beforeUpload = async (file: UploadRawFile) => {
  // 文件大小验证
  if (file.size > maxSizeBytes.value) {
    ElMessage.error(`文件大小不能超过 ${maxSizeMB.value}MB`)
    return false
  }

  // 文件类型验证
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('只支持 JPEG、PNG、WebP、GIF 格式的图片')
    return false
  }

  // 生成预览
  if (props.showPreview) {
    previewUrl.value = URL.createObjectURL(file)
  }

  // 开始上传
  uploading.value = true

  try {
    const result = await trpc.uploads.uploadFile.mutate({
      file: file,
      type: props.type,
      articleId: props.articleId,
    })

    ElMessage.success('上传成功')
    emit('success', result.url)

    return false // 阻止 el-upload 的默认上传行为
  } catch (error: any) {
    ElMessage.error(error.message || '上传失败')
    emit('error', error.message)
    clearPreview()
    return false
  } finally {
    uploading.value = false
  }
}

// 上传成功回调（实际不会触发，因为我们阻止了默认行为）
const handleSuccess = () => {
  // 这里不会执行
}

// 上传失败回调
const handleError = (error: any) => {
  ElMessage.error('上传失败')
  emit('error', error.message)
  clearPreview()
  uploading.value = false
}

// 清除预览
const clearPreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

// 手动清除上传
const clearFiles = () => {
  uploadRef.value?.clearFiles()
  clearPreview()
}

defineExpose({
  clearFiles,
  clearPreview,
})
</script>

<style scoped>
.file-upload {
  margin: 16px 0;
}

.preview {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  text-align: center;
}

.preview img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 6px;
  margin-bottom: 12px;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

:deep(.el-upload) {
  width: 100%;
}

:deep(.el-upload__tip) {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}
</style>
```

## 🔍 深入思考

### 文件上传的性能优化

#### 图片压缩策略

```javascript
// 客户端图片压缩
function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      const { width, height } = img
      const ratio = Math.min(maxWidth / width, maxWidth / height)

      canvas.width = width * ratio
      canvas.height = height * ratio

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(resolve, 'image/jpeg', quality)
    }

    img.src = URL.createObjectURL(file)
  })
}
```

#### 分片上传大文件

```typescript
// 大文件分片上传策略
const CHUNK_SIZE = 1024 * 1024 // 1MB 分片

async function uploadLargeFile(file: File) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const uploadId = crypto.randomUUID()

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    await uploadChunk(chunk, i, totalChunks, uploadId)
  }

  return await finalizeUpload(uploadId)
}
```

## ❓ 遇到的问题

### 问题 1：大文件上传超时

**问题描述**：超过 10MB 的文件在 Workers 环境下上传容易超时  
**解决方案**：

1. 客户端压缩图片
2. 实现分片上传
3. 设置合理的文件大小限制

### 问题 2：CORS 跨域问题

**问题描述**：浏览器直接上传到 R2 时遇到 CORS 问题  
**解决方案**：

```bash
# 配置 R2 CORS 策略
wrangler r2 bucket cors put vue-blog-storage --file=cors.json
```

### 问题 3：文件重复上传处理

**问题描述**：用户可能重复上传相同文件  
**解决方案**：

- 基于文件哈希值去重
- 覆盖式上传策略
- 版本管理机制

## 💡 个人心得

### 今天最大的收获

成功集成了 Cloudflare R2 存储服务，理解了边缘存储的优势和文件上传的最佳实践。

### 文件上传系统的关键设计

1. **客户端优化**：压缩、预览、进度显示
2. **服务端验证**：类型、大小、权限检查
3. **存储策略**：合理的目录结构和文件命名
4. **CDN 加速**：利用 R2 的边缘分发能力

## 📋 行动清单

### 今日完成

- [x] 配置 Cloudflare R2 存储服务
- [x] 实现文件上传的 tRPC procedures
- [x] 创建前端文件上传组件
- [x] 处理图片压缩和权限验证

### 明日预习

- [ ] 了解用户个人资料的数据结构
- [ ] 思考个人中心页面的功能设计
- [ ] 准备用户统计信息的实现

## 🔗 有用链接

- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
- [文件上传最佳实践](https://web.dev/file-upload-best-practices/)
- [图片优化策略](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/image-optimization)

---

**📝 明日重点**：实现用户个人资料管理功能，包括资料编辑和统计展示。
