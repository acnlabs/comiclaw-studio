import { z } from "zod";
import { prisma } from "@/lib/db";
import { mapError, parseBody } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { withAdminSession } from "@/lib/adminSession";

type Ctx = { params: Promise<{ id: string }> };

const featureSchema = z.object({ featured: z.boolean() });

/**
 * Official pick for the For You feed (ADMIN_KEY cookie).
 * Picking stamps the moment; the feed honours it for a window and then lets it
 * lapse, so an old pick cannot quietly hold the top of the feed forever.
 */
export const POST = withAdminSession(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;

  let body: z.infer<typeof featureSchema>;
  try {
    body = await parseBody(req, featureSchema);
  } catch (err) {
    return mapError(err);
  }

  const updated = await prisma.work.updateMany({
    where: { id },
    data: { featuredAt: body.featured ? new Date() : null },
  });
  if (updated.count === 0) return notFoundJson("Work not found");

  const work = await prisma.work.findUnique({
    where: { id },
    select: { id: true, title: true, featuredAt: true },
  });
  return Response.json({ work });
});
