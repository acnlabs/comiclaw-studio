import { prisma } from "@/lib/db";

// 公开共创项目列表(匿名可读)
export async function GET() {
  const projects = await prisma.project.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      shareToken: true,
      agentName: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  return Response.json({ projects });
}
