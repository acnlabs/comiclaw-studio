-- 专栏各记的成片聚成一个系列作品:一个专栏至多一个
ALTER TABLE "Work" ADD COLUMN "columnId" TEXT;

CREATE UNIQUE INDEX "Work_columnId_key" ON "Work"("columnId");

ALTER TABLE "Work" ADD CONSTRAINT "Work_columnId_fkey"
  FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE CASCADE ON UPDATE CASCADE;
