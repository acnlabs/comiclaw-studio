-- CreateTable
CREATE TABLE "AcnTaskRef" (
    "id" TEXT NOT NULL,
    "acnTaskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcnTaskRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcnTaskRef_acnTaskId_key" ON "AcnTaskRef"("acnTaskId");

-- CreateIndex
CREATE INDEX "AcnTaskRef_projectId_createdAt_idx" ON "AcnTaskRef"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AcnTaskRef_type_createdAt_idx" ON "AcnTaskRef"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "AcnTaskRef" ADD CONSTRAINT "AcnTaskRef_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
