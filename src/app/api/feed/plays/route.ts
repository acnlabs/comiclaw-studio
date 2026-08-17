import { z } from "zod";
import { prisma } from "@/lib/db";
import { mapError, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { attachPlayUser, feedViewerHeaders, openFeedViewer } from "@/lib/feedViewer";
import { PLAYS_PER_NETWORK_PER_HOUR } from "@/lib/viewerSession";

const playSchema = z.object({ workId: z.string().trim().min(1).max(64) });

/**
 * Record that a work was actually watched. Open to anyone, because the feed is
 * open to anyone — the protection is the unique key on
 * (workId, viewer, hour): a loop, a re-scroll or a retry all collapse into the
 * same row instead of inflating heat.
 *
 * A signed-in viewer may send a Bearer token; we store the sub on the row so
 * a later personal ranker has something to join. Heat still counts the row
 * whether or not that column is filled.
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

  const viewer = await openFeedViewer(req);

  // The cap is the defence against a caller that simply never sends a cookie:
  // without it every such request looks like a brand new viewer. Counting
  // first and capping second would still let the table grow, so check first.
  const fromNetwork = await prisma.workPlay.count({
    where: { workId: work.id, networkHash: viewer.network, hourBucket: viewer.hour },
  });

  let count = 0;
  if (fromNetwork < PLAYS_PER_NETWORK_PER_HOUR) {
    // skipDuplicates makes the repeat case a no-op rather than an error, so the
    // client never has to care whether this play already counted.
    ({ count } = await prisma.workPlay.createMany({
      data: [
        {
          workId: work.id,
          sessionKey: viewer.sessionKey,
          hourBucket: viewer.hour,
          networkHash: viewer.network,
          userId: viewer.userId,
        },
      ],
      skipDuplicates: true,
    }));
  }

  await attachPlayUser({
    workId: work.id,
    sessionKey: viewer.sessionKey,
    hour: viewer.hour,
    userId: viewer.userId,
  });

  return new Response(JSON.stringify({ counted: count > 0 }), {
    status: 202,
    headers: feedViewerHeaders(viewer.setCookie),
  });
}
