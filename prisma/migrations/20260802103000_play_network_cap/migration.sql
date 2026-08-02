-- cookie 由调用方决定发不发,不发就每次都像新访客,热度可被任意刷。
-- 记来源网络的加盐哈希,按 (作品, 网络, 小时) 封顶。
-- 可空:存量行没有这个信息,不该因此丢掉
ALTER TABLE "WorkPlay" ADD COLUMN "networkHash" TEXT;

CREATE INDEX "WorkPlay_workId_networkHash_hourBucket_idx"
  ON "WorkPlay"("workId", "networkHash", "hourBucket");
