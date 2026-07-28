import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFoundJson } from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";
import { requireColumnOwner } from "@/lib/columnOwner";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  coverUrl: z.string().trim().max(2000).optional().nullable(),
});

/** Owner view of their own column (includes private-ish fields like Org id). */
export async function GET(req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const columnId = rawId?.trim();
  if (!columnId) return notFoundJson();

  const access = await requireColumnOwner(req, columnId);
  if (access instanceof Response) return access;

  const column = await prisma.column.findUniqueOrThrow({
    where: { id: columnId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      acnOrgId: true,
      contributePolicy: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projects: true } },
    },
  });

  return Response.json({ column });
}

/**
 * Rename / edit copy. Slug stays immutable so public links and agent join
 * commands keep working.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const columnId = rawId?.trim();
  if (!columnId) return notFoundJson();

  const access = await requireColumnOwner(req, columnId);
  if (access instanceof Response) return access;

  let body: z.infer<typeof patchSchema>;
  try {
    body = await parseBody(req, patchSchema);
  } catch (err) {
    return mapError(err);
  }

  if (
    body.name === undefined &&
    body.description === undefined &&
    body.coverUrl === undefined
  ) {
    return badRequest("Nothing to update");
  }

  const column = await prisma.column.update({
    where: { id: columnId },
    data: {
      name: body.name ?? undefined,
      description:
        body.description === undefined ? undefined : body.description || null,
      coverUrl: body.coverUrl === undefined ? undefined : body.coverUrl || null,
    },
  });

  return Response.json({ column });
}

/**
 * Delete an empty column.
 * - Columns bound to an ACN Org stay ops-only: deleting the Studio row would
 *   strand the external Org and its members with no management surface.
 * - Entry / request checks run inside a serializable transaction so a
 *   concurrent create cannot slip past the "empty" check.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const columnId = rawId?.trim();
  if (!columnId) return notFoundJson();

  const access = await requireColumnOwner(req, columnId);
  if (access instanceof Response) return access;

  if (access.column.acnOrgId) {
    return conflict(
      "This column is bound to an ACN Org; ask ops to dissolve the Org before deleting"
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const projectCount = await tx.project.count({ where: { columnId } });
        if (projectCount > 0) return { deleted: false as const, projectCount };

        await tx.orgJoinRequest.deleteMany({ where: { columnId } });
        await tx.column.delete({ where: { id: columnId } });
        return { deleted: true as const, projectCount: 0 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!result.deleted) {
      return conflict(
        `Column still has ${result.projectCount} entries; remove them before deleting`
      );
    }
  } catch (err) {
    return mapError(err);
  }

  return Response.json({ deleted: true, slug: access.column.slug });
}
