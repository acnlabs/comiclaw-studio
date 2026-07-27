import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody, withRetry } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { shotVersionSchema } from "@/lib/schemas";
import {
  actorFromProductionAuth,
  assertCanMutateContent,
} from "@/lib/contentAuth";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ shotId: string }> };

// 推送分镜新版画面(版本号自动递增,并发安全)
export const POST = withProjectWorkerAuth(
  async (req, ctx: Ctx, auth: ProductionAuth) => {
    const { shotId } = await ctx.params;
    const body = await parseBody(req, shotVersionSchema);

    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      select: {
        id: true,
        projectId: true,
        authorUserId: true,
        authorAgentId: true,
        authorKey: true,
        project: { select: { ownerUserId: true, visibility: true } },
      },
    });
    if (!shot) return notFoundJson();

    const denied = assertCanMutateContent(
      shot,
      shot.project,
      actorFromProductionAuth(auth)
    );
    if (denied) return denied;

    const created = await withRetry(async () => {
      const latest = await prisma.shotVersion.findFirst({
        where: { shotId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      return prisma.shotVersion.create({
        data: {
          shotId,
          version: (latest?.version ?? 0) + 1,
          mediaUrl: body.mediaUrl,
          mediaType: body.mediaType ?? "IMAGE",
          notes: body.notes ?? null,
        },
      });
    });

    emitProjectUpdate(shot.projectId, "shot.version.created");
    return Response.json({ shotVersion: created }, { status: 201 });
  },
  {
    getProjectId: async (_req, ctx) => {
      const { shotId } = await ctx.params;
      const shot = await prisma.shot.findUnique({
        where: { id: shotId },
        select: { projectId: true },
      });
      return shot?.projectId ?? null;
    },
  }
);
