FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# 构建时提供占位数据库地址,运行时以环境变量覆盖
ENV DATABASE_URL="file:/app/data/studio.db"
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# 数据库文件放在 /app/data,挂载卷持久化
VOLUME ["/app/data"]

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
