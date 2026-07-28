-- CreateTable
CREATE TABLE "Column" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Column_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "columnId" TEXT;
ALTER TABLE "Project" ADD COLUMN "entryOrder" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Column_slug_key" ON "Column"("slug");
CREATE INDEX "Column_updatedAt_idx" ON "Column"("updatedAt");
CREATE INDEX "Project_columnId_entryOrder_idx" ON "Project"("columnId", "entryOrder");
CREATE UNIQUE INDEX "Project_columnId_entryOrder_key" ON "Project"("columnId", "entryOrder");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
