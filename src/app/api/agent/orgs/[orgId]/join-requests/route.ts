import { withAgentAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ orgId: string }> };

/** List join requests for an Org (Studio key / ops). */
export const GET = withAgentAuth(async (req, ctx: Ctx) => {
  const { orgId: raw } = await ctx.params;
  const orgId = raw?.trim();
  if (!orgId) return notFoundJson();

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim();

  const requests = await prisma.orgJoinRequest.findMany({
    where: {
      acnOrgId: orgId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      column: { select: { id: true, slug: true, name: true } },
    },
  });

  return Response.json({
    acnOrgId: orgId,
    requests: requests.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      status: r.status,
      note: r.note,
      columnId: r.columnId,
      columnSlug: r.column?.slug ?? null,
      columnName: r.column?.name ?? null,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
    })),
  });
});
