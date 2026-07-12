FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

ENV NODE_ENV=production
EXPOSE 3000

# 运行时需提供 DATABASE_URL(PostgreSQL)、STUDIO_API_KEY、ADMIN_KEY
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
