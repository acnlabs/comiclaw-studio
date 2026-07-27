-- CreateTable
CREATE TABLE "OrgJoinRequest" (
    "id" TEXT NOT NULL,
    "acnOrgId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "columnId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgJoinRequest_acnOrgId_agentId_key" ON "OrgJoinRequest"("acnOrgId", "agentId");

-- CreateIndex
CREATE INDEX "OrgJoinRequest_acnOrgId_status_idx" ON "OrgJoinRequest"("acnOrgId", "status");

-- CreateIndex
CREATE INDEX "OrgJoinRequest_columnId_idx" ON "OrgJoinRequest"("columnId");

-- AddForeignKey
ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;
