import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import {
  hourBucket,
  networkHash,
  newViewerKey,
  readViewerKey,
  viewerCookie,
} from "@/lib/viewerSession";

/** Cookie + optional Auth0 sub. The feed is public; a missing token is normal. */
export async function openFeedViewer(req: Request) {
  const existing = readViewerKey(req);
  const sessionKey = existing ?? newViewerKey();
  return {
    existing,
    sessionKey,
    userId: await verifyUserToken(req),
    hour: hourBucket(),
    network: networkHash(req),
    setCookie: existing ? null : viewerCookie(sessionKey),
  };
}

export function feedViewerHeaders(setCookie: string | null): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (setCookie) headers.append("set-cookie", setCookie);
  return headers;
}

/** A later signed-in request can fill in a row that was first recorded anonymously. */
export async function attachPlayUser(args: {
  workId: string;
  sessionKey: string;
  hour: Date;
  userId: string | null;
}) {
  if (!args.userId) return;
  const where = {
    workId: args.workId,
    sessionKey: args.sessionKey,
    hourBucket: args.hour,
    userId: null as string | null,
  };
  await Promise.all([
    prisma.workPlay.updateMany({ where, data: { userId: args.userId } }),
    prisma.workSignal.updateMany({ where, data: { userId: args.userId } }),
  ]);
}
