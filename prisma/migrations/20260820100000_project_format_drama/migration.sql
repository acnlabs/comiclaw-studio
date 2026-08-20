-- 项目类型:VIDEO 短视频(默认,也可做漫剧的一集) | DRAMA 漫剧壳
ALTER TABLE "Project" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'VIDEO';
ALTER TABLE "Project" ADD COLUMN "dramaProjectId" TEXT;
ALTER TABLE "Project" ADD COLUMN "dramaOrder" INTEGER;

CREATE INDEX "Project_format_idx" ON "Project"("format");
CREATE INDEX "Project_dramaProjectId_dramaOrder_idx" ON "Project"("dramaProjectId", "dramaOrder");
CREATE UNIQUE INDEX "Project_dramaProjectId_dramaOrder_key" ON "Project"("dramaProjectId", "dramaOrder");

ALTER TABLE "Project" ADD CONSTRAINT "Project_dramaProjectId_fkey"
  FOREIGN KEY ("dramaProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
