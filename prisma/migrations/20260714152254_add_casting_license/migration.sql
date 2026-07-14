-- AlterTable
ALTER TABLE "AgentCharacter" ADD COLUMN     "licensePoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CastingLicense" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "licenseeSub" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CastingLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CastingLicense_characterId_projectId_key" ON "CastingLicense"("characterId", "projectId");

-- AddForeignKey
ALTER TABLE "CastingLicense" ADD CONSTRAINT "CastingLicense_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "AgentCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingLicense" ADD CONSTRAINT "CastingLicense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
