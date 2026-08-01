-- A marketplace character gets a backing Asset, which becomes the tradable
-- subject: ownership registration and Store listings key off the Asset id, so
-- the comiclaw:character:* namespace stops holding two different id spaces.
-- The character row keeps what is character-specific (persona, acting agent,
-- visibility). Nothing is registered or listed by this migration.
ALTER TABLE "AgentCharacter" ADD COLUMN "assetId" TEXT;

CREATE UNIQUE INDEX "AgentCharacter_assetId_key" ON "AgentCharacter"("assetId");

ALTER TABLE "AgentCharacter"
  ADD CONSTRAINT "AgentCharacter_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
