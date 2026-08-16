-- AlterTable
ALTER TABLE "Project" ADD COLUMN "ownerKind" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "Project" ADD COLUMN "ownerAgentId" TEXT;
ALTER TABLE "Project" ADD COLUMN "ownerOrgId" TEXT;

UPDATE "Project" SET "ownerKind" = 'user' WHERE "ownerUserId" IS NOT NULL;
UPDATE "Project" SET "ownerKind" = 'agent' WHERE "ownerUserId" IS NULL;

CREATE INDEX "Project_ownerKind_ownerAgentId_idx" ON "Project"("ownerKind", "ownerAgentId");
CREATE INDEX "Project_ownerKind_ownerOrgId_idx" ON "Project"("ownerKind", "ownerOrgId");

-- AlterTable
ALTER TABLE "Work" ADD COLUMN "ownerKind" TEXT;
ALTER TABLE "Work" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "Work" ADD COLUMN "ownerAgentId" TEXT;
ALTER TABLE "Work" ADD COLUMN "ownerOrgId" TEXT;
ALTER TABLE "Work" ADD COLUMN "appearingAgentId" TEXT;

UPDATE "Work" AS w
SET
  "ownerKind" = p."ownerKind",
  "ownerUserId" = p."ownerUserId",
  "ownerAgentId" = p."ownerAgentId",
  "ownerOrgId" = p."ownerOrgId"
FROM "Project" AS p
WHERE w."projectId" = p."id";

CREATE INDEX "Work_ownerKind_ownerUserId_idx" ON "Work"("ownerKind", "ownerUserId");
CREATE INDEX "Work_ownerKind_ownerAgentId_idx" ON "Work"("ownerKind", "ownerAgentId");
CREATE INDEX "Work_ownerKind_ownerOrgId_idx" ON "Work"("ownerKind", "ownerOrgId");
CREATE INDEX "Work_appearingAgentId_idx" ON "Work"("appearingAgentId");

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "UserProfile_handle_key" ON "UserProfile"("handle");
