-- CreateTable
CREATE TABLE "AgentCharacter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "persona" TEXT,
    "styleTags" TEXT,
    "imageUrl" TEXT NOT NULL,
    "audioUrl" TEXT,
    "gallery" TEXT,
    "acnAgentId" TEXT,
    "agentName" TEXT,
    "agentSummary" TEXT,
    "agentUrl" TEXT,
    "ownerUserId" TEXT,
    "sourceProjectId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "openForCasting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentCharacter_isPublic_idx" ON "AgentCharacter"("isPublic");

-- CreateIndex
CREATE INDEX "AgentCharacter_ownerUserId_idx" ON "AgentCharacter"("ownerUserId");
