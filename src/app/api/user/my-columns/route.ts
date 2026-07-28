import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";

/** Columns owned by the signed-in user (for Studio create picker). */
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
    },
  });

  return Response.json({ columns });
}
