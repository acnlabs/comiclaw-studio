-- Usage rights on a project asset can now be sold, not just given away.
-- licensePoints = 0 keeps the existing free-licensing behaviour; above zero the
-- asset is listed on the AgentPlanet Store, where the seller has to match the
-- registry owner — which is why the product id lives next to ownerType/ownerId.
ALTER TABLE "Asset" ADD COLUMN "licensePoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Asset" ADD COLUMN "storeProductId" TEXT;

CREATE UNIQUE INDEX "Asset_storeProductId_key" ON "Asset"("storeProductId");
