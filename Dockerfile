# 构建阶段
FROM node:20-alpine as build-stage
WORKDIR /app
# 只复制 package 文件，利用缓存
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci  # 使用 ci 代替 install，更快更稳定

# 复制源代码并构建
COPY . .
RUN npm run build

# 生产阶段 - 使用更小的基础镜像
FROM nginx:alpine-slim

# 清理不需要的文件
RUN rm -rf /usr/share/nginx/html/* && \
    rm -rf /etc/nginx/conf.d/*

# 只复制构建产物和配置
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 设置目录权限
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]