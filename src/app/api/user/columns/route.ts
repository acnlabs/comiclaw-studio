import { z } from "zod";
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
import { checkColumnQuota } from "@/lib/columnQuota";

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

  const quota = await checkColumnQuota({
    ownerUserId: sub,
    wantsOrgCreate: body.orgMode === "create",
  });
  if (!quota.allowed) {
    return tooManyRequests(
      quota.reason === "columns"
        ? `You already own ${quota.limit} columns; delete one or ask ops to raise the limit`
        : `Daily limit of ${quota.limit} new co-creation Orgs reached; retry tomorrow or create the column with orgMode=none`
    );
  }

  const bind = await resolveOrgBindOnCreate({
    mode: body.orgMode,
    acnOrgId: body.acnOrgId,
    displayName: body.name,
    stewardAgentId: body.stewardAgentId,
    joinPolicy: body.orgJoinPolicy,
  });
  if (bind instanceof Response) return bind;

  const column = await prisma.column.create({
    data: {
      slug,
      name: body.name,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      ownerUserId: sub,
      acnOrgId: bind.acnOrgId,
      acnSubnetId: bind.acnSubnetId,
      contributePolicy: body.contributePolicy ?? "org_members",
    },
  });

  return Response.json({ column }, { status: 201 });
}
