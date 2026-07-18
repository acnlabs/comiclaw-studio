-- CreateTable
CREATE TABLE "ChatUsage" (
    "userSub" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUsage_pkey" PRIMARY KEY ("userSub","day")
);
