import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";

/** Columns owned by the signed-in user (Studio create picker + owner admin). */
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const columns = await prisma.column.findMany({
    where: { ownerUserId: sub },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      name: true,
      acnOrgId: true,
      contributePolicy: true,
      updatedAt: true,
      _count: {
        select: {
          projects: true,
          orgJoinRequests: { where: { status: { in: ["pending", "approving"] } } },
        },
      },
    },
  });

  return Response.json({
    columns: columns.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      acnOrgId: c.acnOrgId,
      contributePolicy: c.contributePolicy,
      entryCount: c._count.projects,
      pendingJoinRequests: c._count.orgJoinRequests,
      updatedAt: c.updatedAt,
    })),
  });
}
