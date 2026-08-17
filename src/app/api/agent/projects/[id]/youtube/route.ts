import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { withProjectWorkerAuth, parseBody } from "@/lib/api";
import { forbidden, notFoundJson } from "@/lib/auth";
import { youtubeListingSchema } from "@/lib/schemas";
import { gateAgentProjectAction } from "@/lib/contributeGate";
import {
  getYoutubePublishSnapshot,
  publishProjectToYoutube,
} from "@/lib/youtubePublish";
import type { ProductionAuth } from "@/lib/acnAuth";

export const maxDuration = 300;

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

    const snapshot = await getYoutubePublishSnapshot(id);
    if (!snapshot) return notFoundJson();
    return Response.json(snapshot);
  },
);

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

    const body = await parseBody(req, youtubeListingSchema.partial());
    const published = await publishProjectToYoutube(id, {
      ...body,
      title: body.title?.trim() || project.name,
    });
    emitProjectUpdate(id, "youtube.published");
    return Response.json(published);
  },
);
