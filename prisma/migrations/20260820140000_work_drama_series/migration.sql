-- 漫剧系列挂在壳上,不占用各集成片的 Work.projectId
ALTER TABLE "Work" ADD COLUMN "dramaProjectId" TEXT;

UPDATE "Work" AS w
SET "dramaProjectId" = w."projectId",
    "projectId" = NULL
FROM "Project" AS p
WHERE w."projectId" = p."id"
  AND w."kind" = 'SERIES'
  AND p."format" = 'DRAMA';

CREATE UNIQUE INDEX "Work_dramaProjectId_key" ON "Work"("dramaProjectId");

ALTER TABLE "Work" ADD CONSTRAINT "Work_dramaProjectId_fkey"
  FOREIGN KEY ("dramaProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
