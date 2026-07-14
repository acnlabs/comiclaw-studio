-- CreateTable
CREATE TABLE "WorkCast" (
    "workId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "WorkCast_pkey" PRIMARY KEY ("workId","characterId")
);

-- AddForeignKey
ALTER TABLE "WorkCast" ADD CONSTRAINT "WorkCast_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCast" ADD CONSTRAINT "WorkCast_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "AgentCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
