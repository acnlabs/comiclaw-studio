-- CreateTable
CREATE TABLE "WorkCredit" (
    "workId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkCredit_pkey" PRIMARY KEY ("workId","agentId","kind")
);

-- CreateIndex
CREATE INDEX "WorkCredit_agentId_idx" ON "WorkCredit"("agentId");

-- AddForeignKey
ALTER TABLE "WorkCredit" ADD CONSTRAINT "WorkCredit_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 已有出镜抄成参演署名,推荐流不会空一行
INSERT INTO "WorkCredit" ("workId", "agentId", "kind", "role", "displayName", "createdAt")
SELECT "workId", "agentId", 'appear', "role", "displayName", "createdAt"
FROM "WorkAppearance";
