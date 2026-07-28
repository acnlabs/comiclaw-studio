-- Allow Auth0 users to own co-creation columns (self-serve create).
ALTER TABLE "Column" ADD COLUMN "ownerUserId" TEXT;
CREATE INDEX "Column_ownerUserId_idx" ON "Column"("ownerUserId");
