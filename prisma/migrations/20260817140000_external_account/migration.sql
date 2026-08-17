-- CreateTable
CREATE TABLE "ExternalAccount" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelId" TEXT,
    "channelTitle" TEXT,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccount_ownerType_ownerId_platform_key" ON "ExternalAccount"("ownerType", "ownerId", "platform");

-- CreateIndex
CREATE INDEX "ExternalAccount_ownerId_platform_idx" ON "ExternalAccount"("ownerId", "platform");
