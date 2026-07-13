-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Project_ownerUserId_idx" ON "Project"("ownerUserId");
