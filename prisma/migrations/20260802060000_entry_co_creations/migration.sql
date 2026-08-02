-- 一记是横向的:官方项目为锚,其他创作者的二创 / 共创各自成项目挂在锚下。
-- Restrict:删锚点会带走别人的项目,所以在应用层显式拦截而不是级联
ALTER TABLE "Project" ADD COLUMN "parentProjectId" TEXT;

CREATE INDEX "Project_parentProjectId_idx" ON "Project"("parentProjectId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey"
  FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
