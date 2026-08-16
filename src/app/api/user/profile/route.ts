import { z } from "zod";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest } from "@/lib/auth";
import { parseBody, withRouteErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureUserProfile, normalizeHandle } from "@/lib/userHandle";

const patchSchema = z.object({
  handle: z.string().trim().min(2).max(32).optional(),
  displayName: z.string().trim().max(80).optional().nullable(),
});

export const GET = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const profile = await ensureUserProfile(sub);
  return Response.json({
    profile: {
      handle: profile.handle,
      displayName: profile.displayName,
      href: `/u/${profile.handle}`,
    },
  });
});

export const PATCH = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const body = await parseBody(req, patchSchema);
  const current = await ensureUserProfile(sub, body.displayName);

  let handle = current.handle;
  if (body.handle !== undefined) {
    const next = normalizeHandle(body.handle);
    if (!next) return badRequest("Invalid handle");
    if (next !== current.handle) {
      const taken = await prisma.userProfile.findUnique({ where: { handle: next } });
      if (taken) return badRequest("Handle already taken");
      handle = next;
    }
  }

  const profile = await prisma.userProfile.update({
    where: { userId: sub },
    data: {
      handle,
      displayName:
        body.displayName === undefined ? undefined : body.displayName?.trim() || null,
    },
  });
  return Response.json({
    profile: {
      handle: profile.handle,
      displayName: profile.displayName,
      href: `/u/${profile.handle}`,
    },
  });
});
