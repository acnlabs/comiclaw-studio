-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareToken" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "agentName" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "currentStage" TEXT NOT NULL DEFAULT 'SCRIPT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScriptVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT,
    "logline" TEXT,
    "content" TEXT NOT NULL,
    "changeLog" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScriptVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "duration" REAL,
    "dialogue" TEXT,
    "action" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShotVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShotVersion_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShotAsset" (
    "shotId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    PRIMARY KEY ("shotId", "assetId"),
    CONSTRAINT "ShotAsset_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShotAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FilmVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "duration" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FilmVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publishedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptVersion_projectId_version_key" ON "ScriptVersion"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVersion_assetId_version_key" ON "AssetVersion"("assetId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_projectId_order_key" ON "Shot"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ShotVersion_shotId_version_key" ON "ShotVersion"("shotId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FilmVersion_projectId_version_key" ON "FilmVersion"("projectId", "version");
