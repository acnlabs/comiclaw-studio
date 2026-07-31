-- Licensing a published asset into another project. CastingLicense only covers
-- AgentCharacter, so scenes and props could be registered but never used.
-- points/storeOrderId are here from the start so paid licensing does not need
-- another migration; free licensing leaves them at 0/null.
CREATE TABLE "AssetLicense" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "licenseeSub" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "storeOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLicense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetLicense_assetId_projectId_key" ON "AssetLicense"("assetId", "projectId");
CREATE UNIQUE INDEX "AssetLicense_storeOrderId_key" ON "AssetLicense"("storeOrderId");
CREATE INDEX "AssetLicense_licenseeSub_status_idx" ON "AssetLicense"("licenseeSub", "status");

-- The source asset is what was licensed; losing it would orphan the record.
ALTER TABLE "AssetLicense" ADD CONSTRAINT "AssetLicense_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetLicense" ADD CONSTRAINT "AssetLicense_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
