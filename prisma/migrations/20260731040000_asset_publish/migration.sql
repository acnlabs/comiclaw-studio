-- Promote a project asset into a registered, tradable asset.
-- Ownership uses the AgentPlanet registry principal (user | agent | org);
-- publishedVersionId pins the "定妆" version so buyers get a stable artefact.
ALTER TABLE "Asset" ADD COLUMN "ownerType" TEXT;
ALTER TABLE "Asset" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "publishedVersionId" TEXT;
ALTER TABLE "Asset" ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE INDEX "Asset_publishedAt_idx" ON "Asset"("publishedAt");
CREATE INDEX "Asset_ownerType_ownerId_idx" ON "Asset"("ownerType", "ownerId");

-- A published asset must keep pointing at a real version of itself.
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_publishedVersionId_fkey"
  FOREIGN KEY ("publishedVersionId") REFERENCES "AssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
