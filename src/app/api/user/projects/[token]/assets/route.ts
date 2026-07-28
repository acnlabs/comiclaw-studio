import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { parseBody, withRouteErrors } from "@/lib/api";
import { createAssetSchema } from "@/lib/schemas";
import { requireUserContributor } from "@/lib/userContribute";

type Ctx = { params: Promise<{ token: string }> };

export const POST = withRouteErrors(async (req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const gate = await requireUserContributor(req, token);
  if (gate instanceof Response) return gate;

  const body = await parseBody(req, createAssetSchema);
  const { project, author } = gate;

  const asset = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: body.type,
      name: body.name,
      description: body.description ?? null,
      authorUserId: author.authorUserId,
      authorAgentId: author.authorAgentId,
      authorKey: author.authorKey,
      versions: body.imageUrl
        ? {
            create: {
              version: 1,
              imageUrl: body.imageUrl,
              audioUrl: body.audioUrl ?? null,
              notes: body.notes ?? null,
            },
          }
        : undefined,
    },
    include: { versions: true },
  });

  emitProjectUpdate(project.id, "asset.created");
  return Response.json({ asset }, { status: 201 });
});
