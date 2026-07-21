-- CreateTable
CREATE TABLE "GenerationChargeRef" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userSub" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "amount" INTEGER,
    "action" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationChargeRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationChargeRef_jobId_key" ON "GenerationChargeRef"("jobId");

-- CreateIndex
CREATE INDEX "GenerationChargeRef_projectId_idx" ON "GenerationChargeRef"("projectId");

-- CreateIndex
CREATE INDEX "GenerationChargeRef_userSub_idx" ON "GenerationChargeRef"("userSub");

-- AddForeignKey
ALTER TABLE "GenerationChargeRef" ADD CONSTRAINT "GenerationChargeRef_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
