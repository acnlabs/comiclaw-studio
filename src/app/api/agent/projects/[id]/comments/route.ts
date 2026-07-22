import { prisma } from "@/lib/db";
import { withProjectWorkerAuth } from "@/lib/api";
import { notFoundJson } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// agent 读取项目批注(默认只看未处理的;?status=all 看全部)
export const GET = withProjectWorkerAuth(
  async (req, ctx: Ctx) => {
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) return notFoundJson();

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const comments = await prisma.comment.findMany({
      where: {
        projectId: id,
        ...(status === "all" ? {} : { status: "OPEN" }),
      },
      orderBy: [{ filmVersionId: "asc" }, { timecode: "asc" }, { createdAt: "asc" }],
      include: { filmVersion: { select: { version: true } } },
    });
    return Response.json({
      comments: comments.map((c) => ({
        id: c.id,
        filmVersion: c.filmVersion.version,
        timecode: c.timecode,
        content: c.content,
        authorName: c.authorName,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  },
  { access: "read" }
);
