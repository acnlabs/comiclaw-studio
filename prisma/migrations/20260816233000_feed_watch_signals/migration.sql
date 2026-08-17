-- 登录用户挂到播放行上,热度仍按行数算,不依赖这一列
ALTER TABLE "WorkPlay" ADD COLUMN "userId" TEXT;
CREATE INDEX "WorkPlay_userId_createdAt_idx" ON "WorkPlay"("userId", "createdAt");

-- 划走 / 完播。先记,排序以后再用;不计入热度
CREATE TABLE "WorkSignal" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "networkHash" TEXT,
    "hourBucket" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkSignal_workId_sessionKey_kind_hourBucket_key"
  ON "WorkSignal"("workId", "sessionKey", "kind", "hourBucket");
CREATE INDEX "WorkSignal_workId_kind_createdAt_idx"
  ON "WorkSignal"("workId", "kind", "createdAt");
CREATE INDEX "WorkSignal_userId_kind_createdAt_idx"
  ON "WorkSignal"("userId", "kind", "createdAt");
CREATE INDEX "WorkSignal_workId_networkHash_kind_hourBucket_idx"
  ON "WorkSignal"("workId", "networkHash", "kind", "hourBucket");

ALTER TABLE "WorkSignal" ADD CONSTRAINT "WorkSignal_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
