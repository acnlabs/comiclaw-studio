import { z } from "zod";
import { prisma } from "@/lib/db";
import { mapError, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import {
  hourBucket,
  newViewerKey,
  readViewerKey,
  viewerCookie,
} from "@/lib/viewerSession";

const playSchema = z.object({ workId: z.string().trim().min(1).max(64) });

/**
 * Record that a work was actually watched. Open to anyone, because the feed is
 * open to anyone — the protection is the unique key on
 * (workId, viewer, hour): a loop, a re-scroll or a retry all collapse into the
 * same row instead of inflating heat.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof playSchema>;
  try {
    body = await parseBody(req, playSchema);
  } catch (err) {
    return mapError(err);
  }

  const work = await prisma.work.findUnique({
    where: { id: body.workId },
    select: { id: true },
  });
  if (!work) return notFoundJson("Work not found");

  const existing = readViewerKey(req);
  const sessionKey = existing ?? newViewerKey();

  // skipDuplicates makes the repeat case a no-op rather than an error, so the
  // client never has to care whether this play already counted.
  const { count } = await prisma.workPlay.createMany({
    data: [{ workId: work.id, sessionKey, hourBucket: hourBucket() }],
    skipDuplicates: true,
  });

  const headers = new Headers({ "content-type": "application/json" });
  if (!existing) headers.append("set-cookie", viewerCookie(sessionKey));
  return new Response(JSON.stringify({ counted: count > 0 }), {
    status: 202,
    headers,
  });
}
