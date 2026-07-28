import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import {
  unauthorized,
  badRequest,
  conflict,
  tooManyRequests,
} from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";
import { createColumnSchema } from "@/lib/schemas";
import { resolveOrgBindOnCreate } from "@/lib/orgBinding";
import { slugifyLabel } from "@/lib/slugify";
import { claimColumnSlot } from "@/lib/columnQuota";

const userCreateColumnSchema = createColumnSchema
  .extend({
    /** Optional — derived from name when omitted */
    slug: createColumnSchema.shape.slug.optional(),
  })
  .superRefine((val, ctx) => {
    // Users cannot prove ACN Org stewardship via Auth0 yet — block attach.
    if (val.orgMode === "attach" || val.acnOrgId?.trim()) {
      ctx.addIssue({
        code: "custom",
        message:
          "orgMode=attach is not available for user-created columns; use create or none",
        path: ["orgMode"],
      });
    }
  });

// 公开栏目列表(匿名可读);只展示至少有一个 PUBLIC 项目的栏目
export async function GET() {
  const columns = await prisma.column.findMany({
    where: {
      projects: { some: { visibility: "PUBLIC" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      acnOrgId: true,
      contributePolicy: true,
      updatedAt: true,
      _count: {
        select: { projects: { where: { visibility: "PUBLIC" } } },
      },
    },
  });

  return Response.json({
    columns: columns.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      coverUrl: c.coverUrl,
      acnOrgId: c.acnOrgId,
      contributePolicy: c.contributePolicy,
      entryCount: c._count.projects,
      updatedAt: c.updatedAt,
    })),
  });
}

/** Create a co-creation column owned by the signed-in user. */
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  let body: z.infer<typeof userCreateColumnSchema>;
  try {
    body = await parseBody(req, userCreateColumnSchema);
  } catch (err) {
    return mapError(err);
  }

  const slug =
    body.slug?.trim() ||
    slugifyLabel(body.name) ||
    `column-${Date.now().toString(36)}`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return badRequest("slug must be lowercase kebab-case");
  }

  const exists = await prisma.column.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (exists) return conflict(`Column slug already exists: ${slug}`);

  const wantsOrgCreate = body.orgMode === "create";

  // Quota check + row insert share one serializable transaction so parallel
  // requests cannot both read a stale count.
  let claim: Awaited<ReturnType<typeof claimColumnSlot>>;
  try {
    claim = await claimColumnSlot({
      ownerUserId: sub,
      slug,
      name: body.name,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      contributePolicy: body.contributePolicy ?? "org_members",
      wantsOrgCreate,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return conflict(`Column slug already exists: ${slug}`);
    }
    return mapError(err);
  }

  if (!claim.ok) {
    return tooManyRequests(
      claim.decision.reason === "columns"
        ? `You already own ${claim.decision.limit} columns; ask ops to raise the limit`
        : `Daily limit of ${claim.decision.limit} new co-creation Orgs reached; retry after 00:00 UTC or create the column with orgMode=none`
    );
  }

  if (!wantsOrgCreate) {
    const column = await prisma.column.findUniqueOrThrow({
      where: { id: claim.columnId },
    });
    return Response.json({ column }, { status: 201 });
  }

  const bind = await resolveOrgBindOnCreate({
    mode: "create",
    displayName: body.name,
    stewardAgentId: body.stewardAgentId,
    joinPolicy: body.orgJoinPolicy,
  });
  if (bind instanceof Response) {
    // Keep the reserved row out of the way; the day's allowance stays spent.
    await prisma.column
      .delete({ where: { id: claim.columnId } })
      .catch((err) =>
        console.error("[user/columns] rollback after Org bind failed", err)
      );
    return bind;
  }

  const column = await prisma.column.update({
    where: { id: claim.columnId },
    data: { acnOrgId: bind.acnOrgId, acnSubnetId: bind.acnSubnetId },
  });

  return Response.json({ column }, { status: 201 });
}
