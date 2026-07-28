-- Track when a user-triggered ACN Org create was claimed, so the per-user daily
-- quota counts attempts (not just rows that ended up with an acnOrgId).
ALTER TABLE "Column" ADD COLUMN "orgCreatedAt" TIMESTAMP(3);
CREATE INDEX "Column_ownerUserId_orgCreatedAt_idx" ON "Column"("ownerUserId", "orgCreatedAt");
