-- publishedAt alone could not tell "publish in flight" from "published", so a
-- concurrent unpublish could revoke a registration that was still being made.
-- draft | publishing | published | unpublishing
ALTER TABLE "Asset" ADD COLUMN "publishState" TEXT NOT NULL DEFAULT 'draft';

UPDATE "Asset" SET "publishState" = 'published' WHERE "publishedAt" IS NOT NULL;

CREATE INDEX "Asset_publishState_idx" ON "Asset"("publishState");
