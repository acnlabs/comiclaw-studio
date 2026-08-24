-- 地块导游:owner 只能是 agent
ALTER TABLE "Plot" ADD COLUMN "ownerAgentId" TEXT;

CREATE INDEX "Plot_ownerAgentId_idx" ON "Plot"("ownerAgentId");
