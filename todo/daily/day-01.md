# Day 1: tRPC 基础概念学习

> 📅 **日期**：**\_**  
> ⏰ **计划时长**：1小时  
> ⏱️ **实际时长**：**\_**  
> 📊 **完成度**：\_\_\_\_%

## 🎯 今日任务

- [ ] 阅读 [tRPC 官方文档](https://trpc.io/docs/quickstart) 基础部分
- [ ] 理解 RPC vs REST 的区别和优势
- [ ] 学习 tRPC 的核心概念：Router、Procedure、Client
- [ ] 观看一个 tRPC 快速入门视频教程

## 📚 学习笔记

### tRPC 核心概念

#### RPC vs REST

```
RPC (Remote Procedure Call):
- 面向过程/函数调用
- 强类型，端到端类型安全
- 客户端像调用本地函数一样调用远程函数

REST (Representational State Transfer):
- 面向资源和HTTP动词
- 弱类型，需要手动维护接口类型
- 客户端通过HTTP请求操作资源
```

#### tRPC 三大核心

1. **Router** - 路由定义
2. **Procedure** - 具体的API方法
3. **Client** - 客户端调用

### 代码示例

```typescript
// 后端 Router 定义
const appRouter = router({
  getUser: publicProcedure.input(z.string()).query(({ input }) => {
    return { id: input, name: 'John' }
  }),
})

// 前端调用
const user = await trpc.getUser.query('123')
//    ↑ 完全类型安全，自动推断返回类型
```

## 🔍 深入思考

### tRPC 的优势

1. **类型安全**：前后端共享类型定义
2. **开发体验**：IDE 自动补全和错误提示
3. **重构友好**：修改后端接口，前端自动更新
4. **性能优化**：自动请求批处理

### 与当前项目的关系

当前项目使用 axios + REST API：

```typescript
// 现状 - 无类型安全
const user = await axios.get(`/api/users/${id}`)
// user 类型未知，需要手动断言

// 升级后 - 完全类型安全
const user = await trpc.users.getById.query(id)
// user 类型自动推断
```

## ❓ 遇到的问题

### 问题 1：

**问题描述**：**\_**  
**解决方案**：**\_**

### 问题 2：

**问题描述**：**\_**  
**解决方案**：**\_**

## 🎥 观看的视频/文章

1. **[视频标题]**(**\_**) - 时长：\_\_\_分钟

   - 核心要点：**\_**
   - 个人收获：**\_**

2. **[文章标题]**(**\_**)
   - 核心要点：**\_**
   - 个人收获：**\_**

## 💡 个人心得

### 今天最大的收获

---

### 对项目升级的新理解

---

### 明天需要重点关注的问题

---

## 📋 行动清单

### 今日完成

- [ ] ***
- [ ] ***

### 明日预习

- [ ] 了解 Hono 框架基础概念
- [ ] 思考 Hono vs Express 的区别

## 🔗 有用链接

- [tRPC 官方文档](https://trpc.io/docs)
- [tRPC Example Repository](https://github.com/trpc/trpc/tree/main/examples)
- [RPC vs REST 详细对比](https://www.smashingmagazine.com/2016/09/understanding-rest-and-rpc-for-http-apis/)

---

**📝 学习小贴士**：记录具体的代码示例和个人理解，这些将成为后续开发的宝贵参考资料。
