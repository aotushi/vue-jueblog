FROM node:20-alpine
WORKDIR /usr/src/app

RUN pwd && ls -la

# 添加非 root 用户
RUN adduser -D -H -u 1001 nodeuser && \
    chown -R nodeuser:nodeuser /usr/src/app

# 只复制 package 文件
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --production && \
    # 清理 npm 缓存
    npm cache clean --force

RUN pwd && ls -la

# 复制源代码
COPY --chown=nodeuser:nodeuser . .

RUN pwd && ls -la

# 使用非 root 用户
USER nodeuser

EXPOSE 9000
CMD ["node", "index.js"] 