-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filmVersionId" TEXT NOT NULL,
    "timecode" DOUBLE PRECISION,
    "content" TEXT NOT NULL,
    "authorSub" TEXT NOT NULL,
    "authorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_projectId_status_idx" ON "Comment"("projectId", "status");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_filmVersionId_fkey" FOREIGN KEY ("filmVersionId") REFERENCES "FilmVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
