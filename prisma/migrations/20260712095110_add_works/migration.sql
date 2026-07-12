-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "videoUrl" TEXT,
    "authorName" TEXT,
    "projectId" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "videoUrl" TEXT NOT NULL,
    "duration" REAL,
    CONSTRAINT "Episode_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Work_projectId_key" ON "Work"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_workId_order_key" ON "Episode"("workId", "order");
