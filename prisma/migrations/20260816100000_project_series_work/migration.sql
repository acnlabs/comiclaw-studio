-- 项目可作为某部剧集的一集发布到 ComicLaw
ALTER TABLE "Project" ADD COLUMN "seriesWorkId" TEXT;

CREATE INDEX "Project_seriesWorkId_idx" ON "Project"("seriesWorkId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_seriesWorkId_fkey"
  FOREIGN KEY ("seriesWorkId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
