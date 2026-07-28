-- Project visibility (PRIVATE | PUBLIC)
ALTER TABLE "Project" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';

-- Ensure PUBLIC projects are never private
UPDATE "Project" SET "isPrivate" = false WHERE "visibility" = 'PUBLIC';

CREATE INDEX "Project_visibility_updatedAt_idx" ON "Project"("visibility", "updatedAt");

-- ScriptVersion authorship
ALTER TABLE "ScriptVersion" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "ScriptVersion" ADD COLUMN "authorAgentId" TEXT;
ALTER TABLE "ScriptVersion" ADD COLUMN "authorKey" TEXT NOT NULL DEFAULT 'legacy';

DROP INDEX IF EXISTS "ScriptVersion_projectId_version_key";
CREATE UNIQUE INDEX "ScriptVersion_projectId_authorKey_version_key" ON "ScriptVersion"("projectId", "authorKey", "version");
CREATE INDEX "ScriptVersion_authorUserId_idx" ON "ScriptVersion"("authorUserId");
CREATE INDEX "ScriptVersion_authorAgentId_idx" ON "ScriptVersion"("authorAgentId");

-- Asset authorship
ALTER TABLE "Asset" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "authorAgentId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "authorKey" TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX "Asset_projectId_authorKey_idx" ON "Asset"("projectId", "authorKey");
CREATE INDEX "Asset_authorUserId_idx" ON "Asset"("authorUserId");
CREATE INDEX "Asset_authorAgentId_idx" ON "Asset"("authorAgentId");

-- Shot authorship
ALTER TABLE "Shot" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "Shot" ADD COLUMN "authorAgentId" TEXT;
ALTER TABLE "Shot" ADD COLUMN "authorKey" TEXT NOT NULL DEFAULT 'legacy';

DROP INDEX IF EXISTS "Shot_projectId_order_key";
CREATE UNIQUE INDEX "Shot_projectId_authorKey_order_key" ON "Shot"("projectId", "authorKey", "order");
CREATE INDEX "Shot_authorUserId_idx" ON "Shot"("authorUserId");
CREATE INDEX "Shot_authorAgentId_idx" ON "Shot"("authorAgentId");

-- FilmVersion authorship + derivative link
ALTER TABLE "FilmVersion" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "FilmVersion" ADD COLUMN "authorAgentId" TEXT;
ALTER TABLE "FilmVersion" ADD COLUMN "authorKey" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "FilmVersion" ADD COLUMN "basedOnFilmVersionId" TEXT;

DROP INDEX IF EXISTS "FilmVersion_projectId_version_key";
CREATE UNIQUE INDEX "FilmVersion_projectId_authorKey_version_key" ON "FilmVersion"("projectId", "authorKey", "version");
CREATE INDEX "FilmVersion_authorUserId_idx" ON "FilmVersion"("authorUserId");
CREATE INDEX "FilmVersion_authorAgentId_idx" ON "FilmVersion"("authorAgentId");
CREATE INDEX "FilmVersion_basedOnFilmVersionId_idx" ON "FilmVersion"("basedOnFilmVersionId");

ALTER TABLE "FilmVersion" ADD CONSTRAINT "FilmVersion_basedOnFilmVersionId_fkey" FOREIGN KEY ("basedOnFilmVersionId") REFERENCES "FilmVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
