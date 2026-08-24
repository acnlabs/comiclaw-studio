-- 智能体影游地块:占格 + 起源项目
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL,
    "claimIndex" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "originProjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plot_claimIndex_key" ON "Plot"("claimIndex");
CREATE UNIQUE INDEX "Plot_originProjectId_key" ON "Plot"("originProjectId");
CREATE UNIQUE INDEX "Plot_x_y_key" ON "Plot"("x", "y");

ALTER TABLE "Plot" ADD CONSTRAINT "Plot_originProjectId_fkey"
    FOREIGN KEY ("originProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
