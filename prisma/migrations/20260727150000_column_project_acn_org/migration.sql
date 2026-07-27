-- Column Org binding
ALTER TABLE "Column" ADD COLUMN "acnOrgId" TEXT;
ALTER TABLE "Column" ADD COLUMN "acnSubnetId" TEXT;
ALTER TABLE "Column" ADD COLUMN "contributePolicy" TEXT NOT NULL DEFAULT 'org_members';

CREATE INDEX "Column_acnOrgId_idx" ON "Column"("acnOrgId");

-- Project Org binding / policy override
ALTER TABLE "Project" ADD COLUMN "acnOrgId" TEXT;
ALTER TABLE "Project" ADD COLUMN "contributePolicy" TEXT;

CREATE INDEX "Project_acnOrgId_idx" ON "Project"("acnOrgId");
