-- Fold casting licences into asset licences.
--
-- A casting licence is an asset licence on the character's backing asset:
-- same columns, same money, same lifecycle. Two tables of the same shape have
-- already let the paid path drift once, so the character side stops having its
-- own.
--
-- Done as a migration rather than a script on purpose: it runs with the deploy,
-- so there is never a window where the code reads AssetLicense while a paid
-- casting licence still only exists in CastingLicense — a buyer mid-payment
-- would otherwise be stranded.
--
-- Ids are derived from the character id (`chr_`, `chrv_`) so the whole thing is
-- idempotent and a backing asset is recognisable as one at a glance. Existing
-- CastingLicense ids carry over unchanged, which keeps the two readable
-- side by side while the old table is still around.

-- 1. Every character needs the backing asset the licence will hang off.
INSERT INTO "Asset" (
  id, "projectId", "type", "name", "description",
  "authorUserId", "authorAgentId", "authorKey",
  "publishState", "licensePoints", "createdAt", "updatedAt"
)
SELECT
  'chr_' || c.id,
  NULL,
  'CHARACTER',
  c."name",
  c."tagline",
  c."ownerUserId",
  CASE WHEN c."ownerUserId" IS NULL THEN c."acnAgentId" END,
  CASE
    WHEN c."ownerUserId" IS NOT NULL THEN 'user:' || c."ownerUserId"
    WHEN c."acnAgentId" IS NOT NULL THEN 'agent:' || c."acnAgentId"
    ELSE 'legacy'
  END,
  'draft',
  0,
  NOW(),
  NOW()
FROM "AgentCharacter" c
WHERE c."assetId" IS NULL
ON CONFLICT (id) DO NOTHING;

-- The character's current artwork becomes its first take.
INSERT INTO "AssetVersion" (id, "assetId", "version", "imageUrl", "audioUrl", "createdAt")
SELECT 'chrv_' || c.id, 'chr_' || c.id, 1, c."imageUrl", c."audioUrl", NOW()
FROM "AgentCharacter" c
WHERE c."assetId" IS NULL
ON CONFLICT DO NOTHING;

UPDATE "AgentCharacter" SET "assetId" = 'chr_' || id WHERE "assetId" IS NULL;

-- 2. Carry the licences over. Nothing is registered, listed or charged here —
-- this only moves the record of who licensed what.
INSERT INTO "AssetLicense" (
  id, "assetId", "projectId", "licenseeSub", "points", "status", "storeOrderId", "createdAt"
)
SELECT
  cl.id,
  c."assetId",
  cl."projectId",
  cl."licenseeSub",
  cl."points",
  cl."status",
  cl."storeOrderId",
  cl."createdAt"
FROM "CastingLicense" cl
JOIN "AgentCharacter" c ON c.id = cl."characterId"
WHERE c."assetId" IS NOT NULL
ON CONFLICT DO NOTHING;
