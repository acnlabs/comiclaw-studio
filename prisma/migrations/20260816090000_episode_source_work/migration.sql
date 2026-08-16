-- 选集里的一集可指向已发布的短视频 Work,评论跟那条片子走
ALTER TABLE "Episode" ADD COLUMN "sourceWorkId" TEXT;

CREATE INDEX "Episode_sourceWorkId_idx" ON "Episode"("sourceWorkId");

ALTER TABLE "Episode" ADD CONSTRAINT "Episode_sourceWorkId_fkey"
  FOREIGN KEY ("sourceWorkId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
