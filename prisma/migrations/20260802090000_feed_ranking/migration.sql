-- 官方推荐位:置顶时刻,由信息流按窗口判定是否仍有效
ALTER TABLE "Work" ADD COLUMN "featuredAt" TIMESTAMP(3);
CREATE INDEX "Work_featuredAt_idx" ON "Work"("featuredAt");

-- 观看事件。热度只能从真实观看里算,而这类数据不记就补不回来
CREATE TABLE "WorkPlay" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "hourBucket" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkPlay_pkey" PRIMARY KEY ("id")
);

-- 同一会话对同一作品在同一小时内只算一次:循环播放与来回滚动刷不出热度
CREATE UNIQUE INDEX "WorkPlay_workId_sessionKey_hourBucket_key"
  ON "WorkPlay"("workId", "sessionKey", "hourBucket");
CREATE INDEX "WorkPlay_workId_createdAt_idx" ON "WorkPlay"("workId", "createdAt");
CREATE INDEX "WorkPlay_createdAt_idx" ON "WorkPlay"("createdAt");

ALTER TABLE "WorkPlay" ADD CONSTRAINT "WorkPlay_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
