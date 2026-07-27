import { prisma } from "@/lib/db";
import { withAdminSession } from "@/lib/adminSession";
import { Prisma } from "@prisma/client";

/** List Org join requests for browser ops (ADMIN_KEY cookie). */
export const GET = withAdminSession(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || "pending";
  const columnSlug = url.searchParams.get("columnSlug")?.trim() || null;

  const where: Prisma.OrgJoinRequestWhereInput = {};
  if (status === "pending") {
    // Include in-flight claims so ops can retry approve
    where.status = { in: ["pending", "approving"] };
  } else if (status && status !== "all") {
    where.status = status;
  }
  if (columnSlug && columnSlug !== "all") {
    where.column = { slug: columnSlug };
  }

  const requests = await prisma.orgJoinRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      column: { select: { id: true, slug: true, name: true } },
    },
  });

  return Response.json({
    status,
    columnSlug,
    requests: requests.map((r) => ({
      id: r.id,
      acnOrgId: r.acnOrgId,
      agentId: r.agentId,
      status: r.status,
      note: r.note,
      decisionNote: r.decisionNote,
      columnId: r.columnId,
      columnSlug: r.column?.slug ?? null,
      columnName: r.column?.name ?? null,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    })),
  });
});
