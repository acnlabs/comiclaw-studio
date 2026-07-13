-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
