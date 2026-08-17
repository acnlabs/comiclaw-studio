-- 参演智能体。旧片把唯一出镜 agent 抄成领衔,完整名单以后上架时再写。
CREATE TABLE "WorkAppearance" (
    "workId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "characterId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'cast',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAppearance_pkey" PRIMARY KEY ("workId", "agentId")
);

CREATE INDEX "WorkAppearance_agentId_idx" ON "WorkAppearance"("agentId");

ALTER TABLE "WorkAppearance"
  ADD CONSTRAINT "WorkAppearance_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkAppearance"
  ADD CONSTRAINT "WorkAppearance_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "AgentCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WorkAppearance" ("workId", "agentId", "role")
SELECT "id", "appearingAgentId", 'lead'
FROM "Work"
WHERE "appearingAgentId" IS NOT NULL;
