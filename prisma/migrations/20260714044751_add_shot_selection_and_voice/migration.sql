-- AlterTable
ALTER TABLE "AssetVersion" ADD COLUMN     "audioUrl" TEXT;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "selectedVersion" INTEGER;
