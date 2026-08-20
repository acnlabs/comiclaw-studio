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
      coverUrl: true,
      acnOrgId: true,
      contributePolicy: true,
      updatedAt: true,
      projects: {
        where: { parentProjectId: null },
        select: { updatedAt: true },
      },
      _count: {
        select: {
          projects: true,
          orgJoinRequests: { where: { status: { in: ["pending", "approving"] } } },
        },
      },
    },
  });

  return Response.json({
    columns: columns.map((c) => {
      const latest = c.projects.reduce(
        (max, p) => (p.updatedAt > max ? p.updatedAt : max),
        c.updatedAt,
      );
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        coverUrl: c.coverUrl,
        acnOrgId: c.acnOrgId,
        contributePolicy: c.contributePolicy,
        issueCount: c.projects.length, // 官方记；工作台「全 n 记」
        entryCount: c._count.projects, // 含二创；删栏目拦截仍用这个
        pendingJoinRequests: c._count.orgJoinRequests,
        updatedAt: latest,
      };
    }),
  });
}
