-- CreateTable
CREATE TABLE "WorkCreditNotify" (
    "workId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkCreditNotify_pkey" PRIMARY KEY ("workId","agentId")
);

-- AddForeignKey
ALTER TABLE "WorkCreditNotify" ADD CONSTRAINT "WorkCreditNotify_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
