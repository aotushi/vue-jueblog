# Day 5: TypeScript 和 Zod 验证

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 复习 TypeScript 高级类型（联合类型、泛型等）
- [ ] 学习 [Zod](https://zod.dev/) 数据验证库
- [ ] 练习创建 Zod schema 验证用户输入
- [ ] 了解 Zod 与 TypeScript 的类型推断

## 📚 学习笔记

### TypeScript 高级类型复习

#### 联合类型和交叉类型

```typescript
// 联合类型 (Union Types)
type Status = 'pending' | 'success' | 'error'
type ID = string | number

// 交叉类型 (Intersection Types)
type User = {
  id: string
  name: string
}
type Admin = User & {
  role: 'admin'
  permissions: string[]
}
```

#### 泛型 (Generics)

```typescript
// 基础泛型
interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

type UserResponse = ApiResponse<User>
type ArticleListResponse = ApiResponse<Article[]>

// 条件类型
type NonNullable<T> = T extends null | undefined ? never : T

// 映射类型
type Partial<T> = {
  [P in keyof T]?: T[P]
}
```

#### 工具类型 (Utility Types)

```typescript
interface User {
  id: string
  name: string
  email: string
  password: string
}

type PublicUser = Omit<User, 'password'> // 排除 password
type CreateUser = Pick<User, 'name' | 'email' | 'password'> // 只选择特定字段
type UpdateUser = Partial<Pick<User, 'name' | 'email'>> // 可选的部分字段
```

### Zod 数据验证库

#### 什么是 Zod？

```
TypeScript 优先的数据验证库
- 运行时数据验证
- 自动类型推断
- 组合式 schema 定义
- 详细的错误信息
```

#### 基础 Zod Schema

```typescript
import { z } from 'zod'

// 基础类型
const stringSchema = z.string()
const numberSchema = z.number()
const booleanSchema = z.boolean()

// 对象 schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  email: z.string().email(),
  age: z.number().min(0).max(120).optional(),
  status: z.enum(['active', 'inactive', 'pending']),
})

// 类型推断
type User = z.infer<typeof UserSchema>
// User 类型被自动推断为：
// {
//   id: string
//   name: string
//   email: string
//   age?: number
//   status: 'active' | 'inactive' | 'pending'
// }
```

#### 复杂验证规则

```typescript
// 数组验证
const TagsSchema = z.array(z.string()).min(1).max(5)

// 嵌套对象
const ArticleSchema = z.object({
  id: z.string(),
  title: z.string().min(5).max(200),
  content: z.string().min(10),
  author: UserSchema,
  tags: TagsSchema,
  createdAt: z.date(),
  publishedAt: z.date().nullable(),
})

// 自定义验证
const PhoneSchema = z.string().regex(/^1[3-9]\d{9}$/, {
  message: '请输入正确的手机号格式',
})

const PasswordSchema = z
  .string()
  .min(6, '密码至少6位')
  .max(50, '密码不超过50位')
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字')
```

## 🛠️ 实践练习

### 练习1：用户注册表单验证

```typescript
import { z } from 'zod'

// 定义用户注册 schema
const RegisterSchema = z
  .object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
    username: z
      .string()
      .min(2, '用户名至少2个字符')
      .max(20, '用户名不超过20个字符'),
    password: z.string().min(6, '密码至少6位'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: '两次密码输入不一致',
    path: ['confirmPassword'],
  })

// 类型推断
type RegisterForm = z.infer<typeof RegisterSchema>

// 验证函数
function validateRegister(data: unknown): RegisterForm {
  return RegisterSchema.parse(data)
}

// 安全验证函数
function safeValidateRegister(data: unknown) {
  const result = RegisterSchema.safeParse(data)

  if (!result.success) {
    console.log('验证失败：', result.error.format())
    return null
  }

  return result.data
}

// 测试数据
const testData = {
  phone: '13888888888',
  username: 'testuser',
  password: '123456',
  confirmPassword: '123456',
}

console.log('验证结果：', safeValidateRegister(testData))
```

### 练习2：API 响应数据验证

```typescript
// 定义 API 响应 schema
const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    code: z.number(),
    message: z.string(),
    data: dataSchema,
  })

// 用户信息响应
const UserInfoResponseSchema = ApiResponseSchema(
  z.object({
    id: z.string(),
    username: z.string(),
    avatar: z.string().url().optional(),
    followersCount: z.number(),
    articlesCount: z.number(),
  }),
)

// 文章列表响应
const ArticleListResponseSchema = ApiResponseSchema(
  z.object({
    articles: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string(),
        author: z.object({
          id: z.string(),
          username: z.string(),
        }),
        createdAt: z.string().datetime(),
        likeCount: z.number(),
        commentCount: z.number(),
      }),
    ),
    pagination: z.object({
      page: z.number(),
      size: z.number(),
      total: z.number(),
    }),
  }),
)

type UserInfoResponse = z.infer<typeof UserInfoResponseSchema>
type ArticleListResponse = z.infer<typeof ArticleListResponseSchema>
```

## 🔍 深入思考

### tRPC + Zod 的完美结合

```typescript
// tRPC procedure 定义
const userRouter = router({
  // 输入验证使用 Zod
  register: publicProcedure
    .input(RegisterSchema)
    .mutation(async ({ input }) => {
      // input 已经是类型安全的 RegisterForm
      const user = await createUser(input)
      return user
    }),

  // 输出验证也可以使用 Zod
  getProfile: protectedProcedure
    .input(z.string().uuid())
    .output(UserSchema)
    .query(async ({ input }) => {
      const user = await getUserById(input)
      return UserSchema.parse(user) // 确保输出符合 schema
    }),
})
```

### 与当前项目的集成思路

```typescript
// 当前项目的验证方式
app.post('/api/users/create', async (req, res) => {
  const { phone, password } = req.body

  // 手动验证
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).send({ message: '手机号格式不正确' })
  }
  if (!password || password.length < 6) {
    return res.status(400).send({ message: '密码至少6位' })
  }

  // 处理逻辑...
})

// 使用 Zod + tRPC 的方式
const createUser = publicProcedure
  .input(
    z.object({
      phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
      password: z.string().min(6, '密码至少6位'),
    }),
  )
  .mutation(async ({ input }) => {
    // input 已经通过验证，类型安全
    // 直接处理业务逻辑
  })
```

## ❓ 遇到的问题

### 问题 1：Zod 性能问题

**问题描述**：复杂 schema 验证性能是否会影响 API 响应速度？  
**解决方案**：

- Zod 验证性能通常很好，除非是超大对象
- 可以考虑缓存编译后的 schema
- 对于简单验证，性能影响可忽略

### 问题 2：错误信息本地化

**问题描述**：如何自定义中文错误信息？  
**解决方案**：

```typescript
const messages = {
  required_error: '此字段为必填项',
  invalid_type_error: '字段类型错误',
}

const schema = z.string(messages).min(1, '不能为空')
```

## 🎥 参考资料

1. **[Zod 官方文档](https://zod.dev/)**

   - 核心要点：TypeScript 优先的验证库，自动类型推断
   - 个人收获：理解了运行时验证与类型安全的结合

2. **[TypeScript 高级类型](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)**
   - 核心要点：工具类型和条件类型的使用
   - 个人收获：加深了对 TypeScript 类型系统的理解

## 💡 个人心得

### 今天最大的收获

Zod 不仅仅是验证库，更是连接运行时数据和编译时类型的桥梁。这对构建类型安全的 API 非常重要。

### 与 tRPC 的协同效应

- tRPC 提供端到端类型安全
- Zod 提供运行时数据验证
- 两者结合实现了完整的类型安全链路

### 对项目重构的意义

当前项目的手动验证代码可以大幅简化，同时获得更好的类型安全保障。

## 📋 行动清单

### 今日完成

- [ ] TypeScript 高级类型复习
- [ ] Zod 基础语法学习
- [ ] 实践用户注册表单验证

### 明日预习

- [ ] MSW (Mock Service Worker) 基础概念
- [ ] 了解 MSW 如何替代 Strapi mock 数据
- [ ] 思考 MSW 与 tRPC 的集成方式

## 🔗 有用链接

- [Zod 官方文档](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [tRPC + Zod 示例](https://trpc.io/docs/server/validators)
- [Zod GitHub 仓库](https://github.com/colinhacks/zod)
- [TypeScript 工具类型参考](https://www.typescriptlang.org/docs/handbook/utility-types.html)

---

**📝 明日重点**：学习 MSW，为前端开发时的 Mock 数据方案做准备。
