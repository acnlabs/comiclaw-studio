import { prisma } from "@/lib/db";
import { notFoundJson } from "@/lib/auth";
import { requireColumnOwner } from "@/lib/columnOwner";

type Ctx = { params: Promise<{ id: string }> };

/** Join requests for a column the signed-in user owns. */
export async function GET(req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const columnId = rawId?.trim();
  if (!columnId) return notFoundJson();

  const access = await requireColumnOwner(req, columnId);
  if (access instanceof Response) return access;

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || "pending";

  const requests = await prisma.orgJoinRequest.findMany({
    where: {
      columnId,
      ...(status === "pending"
        ? { status: { in: ["pending", "approving"] } }
        : status !== "all"
          ? { status }
          : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      acnOrgId: true,
      agentId: true,
      status: true,
      note: true,
      decisionNote: true,
      createdAt: true,
      decidedAt: true,
    },
  });

  return Response.json({
    columnId,
    acnOrgId: access.column.acnOrgId,
    status,
    requests: requests.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    })),
  });
}
