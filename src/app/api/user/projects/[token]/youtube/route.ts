import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { parseBody, withRouteErrors } from "@/lib/api";
import { unauthorized, forbidden, notFoundJson } from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";
import { assertCanViewProject } from "@/lib/projectAccess";
import { youtubeListingSchema } from "@/lib/schemas";
import {
  getYoutubePublishSnapshot,
  publishProjectToYoutube,
} from "@/lib/youtubePublish";

export const maxDuration = 300;

type Ctx = { params: Promise<{ token: string }> };

async function loadProject(token: string) {
  return prisma.project.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      ownerUserId: true,
      visibility: true,
      isPrivate: true,
    },
  });
}

function assertCanPublish(
  project: { ownerUserId: string | null },
  sub: string,
): Response | null {
  if (project.ownerUserId === sub) return null;
  if (!project.ownerUserId) {
    return forbidden("Claim this project before publishing");
  }
  return forbidden("Only the project owner can publish to YouTube");
}

export const GET = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await loadProject(token);
  if (!project) return notFoundJson();

  const denied = assertCanViewProject(project, sub);
  if (denied) return denied;

  const snapshot = await getYoutubePublishSnapshot(project.id);
  if (!snapshot) return notFoundJson();

  const isOwner = project.ownerUserId === sub;
  return Response.json({
    ...snapshot,
    isOwner,
    canPublish: isOwner && snapshot.canPublish,
  });
});

export const POST = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await loadProject(token);
  if (!project) return notFoundJson();

  const denied = assertCanPublish(project, sub);
  if (denied) return denied;

  const listing = await parseBody(req, youtubeListingSchema);
  const published = await publishProjectToYoutube(project.id, listing);
  emitProjectUpdate(project.id, "youtube.published");
  return Response.json(published);
});
