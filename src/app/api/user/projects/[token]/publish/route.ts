import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { parseBody, withRouteErrors } from "@/lib/api";
import { unauthorized, forbidden, notFoundJson } from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";
import { assertCanViewProject } from "@/lib/projectAccess";
import { comiclawListingSchema } from "@/lib/schemas";
import {
  getComiclawPublishSnapshot,
  publishProjectToComiclaw,
} from "@/lib/publish";

type Ctx = { params: Promise<{ token: string }> };

async function loadPublishableProject(token: string) {
  return prisma.project.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
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
  return forbidden("Only the project owner can publish to ComicLaw");
}

export const GET = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await loadPublishableProject(token);
  if (!project) return notFoundJson();

  const denied = assertCanViewProject(project, sub);
  if (denied) return denied;

  const snapshot = await getComiclawPublishSnapshot(project.id);
  if (!snapshot) return notFoundJson();

  return Response.json({
    canPublish: project.ownerUserId === sub,
    ...snapshot,
  });
});

export const POST = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const { token } = await ctx.params;
  const project = await loadPublishableProject(token);
  if (!project) return notFoundJson();

  const denied = assertCanPublish(project, sub);
  if (denied) return denied;

  const listing = await parseBody(req, comiclawListingSchema);
  const published = await publishProjectToComiclaw(project.id, listing);
  emitProjectUpdate(project.id, "comiclaw.published");
  return Response.json(published);
});
