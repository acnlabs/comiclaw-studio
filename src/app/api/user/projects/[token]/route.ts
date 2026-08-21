import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { verifyUserToken } from "@/lib/userAuth";
import { findFullProjectByToken } from "@/lib/projectQuery";
import { unauthorized, notFoundJson, forbidden, conflict } from "@/lib/auth";
import { assertCanViewProject } from "@/lib/projectAccess";
import { blocksProjectDelete, PUBLISH_DRAFT } from "@/lib/assetPublish";
import { syncColumnToSeries } from "@/lib/publish";

type Ctx = { params: Promise<{ token: string }> };

// 登录用户读取项目全量数据(PUBLIC / 非私密可读;私密仅主人)
export async function GET(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await findFullProjectByToken(token);
  if (!project) return notFoundJson();

  const denied = assertCanViewProject(project, sub);
  if (denied) return denied;

  const isOwner = project.ownerUserId === sub;
  return Response.json({ project, isOwner });
}

/** Owner deletes their own project (a 记, 集, or 短视频). */
export async function DELETE(req: Request, ctx: Ctx) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { id: true, ownerUserId: true, columnId: true },
  });
  if (!project) return notFoundJson();
  if (project.ownerUserId !== sub) {
    return forbidden("Only the project owner can delete it");
  }

  const coCreations = await prisma.project.count({
    where: { parentProjectId: project.id },
  });
  if (coCreations > 0) {
    return conflict(
      `This entry anchors ${coCreations} co-creation projects; it cannot be deleted`,
    );
  }

  const publishedAssets = await prisma.$transaction(
    async (tx) => {
      const count = await tx.asset.count({
        where: { projectId: project.id, publishState: { not: PUBLISH_DRAFT } },
      });
      if (blocksProjectDelete(count)) return count;
      await tx.project.delete({ where: { id: project.id } });
      return 0;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (blocksProjectDelete(publishedAssets)) {
    return conflict(
      `Project has ${publishedAssets} registered assets; withdraw them before deleting`,
    );
  }

  if (project.columnId) {
    await syncColumnToSeries(project.columnId);
  }
  emitProjectUpdate(project.id, "project.deleted");
  return Response.json({ deleted: true });
}
