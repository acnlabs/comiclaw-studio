import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody } from "@/lib/api";
import { forbidden, notFoundJson } from "@/lib/auth";
import { agentComiclawListingSchema } from "@/lib/schemas";
import { gateAgentProjectAction } from "@/lib/contributeGate";
import {
  getComiclawPublishSnapshot,
  publishProjectToComiclaw,
} from "@/lib/publish";
import type { ProductionAuth } from "@/lib/acnAuth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withProjectWorkerAuth(
  async (req, ctx: Ctx, auth: ProductionAuth) => {
    if (auth.kind === "acn_contributor") {
      return forbidden("ACN contributors cannot publish listings");
    }

    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    if (!project) return notFoundJson();

    const gated = await gateAgentProjectAction({
      req,
      auth,
      projectId: id,
      projectVisibility: project.visibility,
    });
    if (gated) return gated;

    const snapshot = await getComiclawPublishSnapshot(id);
    if (!snapshot) return notFoundJson();
    return Response.json(snapshot);
  },
);

// 带上架文案发布到 ComicLaw。共创投稿者不能改公开页。
export const POST = withProjectWorkerAuth(
  async (req, ctx: Ctx, auth: ProductionAuth) => {
    if (auth.kind === "acn_contributor") {
      return forbidden("ACN contributors cannot publish listings");
    }

    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, visibility: true },
    });
    if (!project) return notFoundJson();

    const gated = await gateAgentProjectAction({
      req,
      auth,
      projectId: id,
      projectVisibility: project.visibility,
    });
    if (gated) return gated;

    const body = await parseBody(req, agentComiclawListingSchema);
    const published = await publishProjectToComiclaw(id, {
      ...body,
      title: body.title?.trim() || project.name,
      mode: body.mode ?? "video",
    });
    emitProjectUpdate(id, "comiclaw.published");
    return Response.json(published);
  },
);
