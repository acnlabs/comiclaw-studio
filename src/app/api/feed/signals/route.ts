import { z } from "zod";
import { prisma } from "@/lib/db";
import { mapError, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { attachPlayUser, feedViewerHeaders, openFeedViewer } from "@/lib/feedViewer";
import { PLAYS_PER_NETWORK_PER_HOUR } from "@/lib/viewerSession";

const signalSchema = z.object({
  workId: z.string().trim().min(1).max(64),
  kind: z.enum(["skip", "complete"]),
});

/**
 * Record a skip or a complete. Same viewer cookie and network cap as plays —
 * these rows are for a later personal ranker and must not inflate heat.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof signalSchema>;
  try {
    body = await parseBody(req, signalSchema);
  } catch (err) {
    return mapError(err);
  }

  const work = await prisma.work.findUnique({
    where: { id: body.workId },
    select: { id: true },
  });
  if (!work) return notFoundJson("Work not found");

  const viewer = await openFeedViewer(req);

  const fromNetwork = await prisma.workSignal.count({
    where: {
      workId: work.id,
      kind: body.kind,
      networkHash: viewer.network,
      hourBucket: viewer.hour,
    },
  });

  let count = 0;
  if (fromNetwork < PLAYS_PER_NETWORK_PER_HOUR) {
    ({ count } = await prisma.workSignal.createMany({
      data: [
        {
          workId: work.id,
          sessionKey: viewer.sessionKey,
          userId: viewer.userId,
          kind: body.kind,
          hourBucket: viewer.hour,
          networkHash: viewer.network,
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
