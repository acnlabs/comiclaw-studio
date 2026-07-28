import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson, forbidden } from "@/lib/auth";
import { mapError, parseBody, withRetry } from "@/lib/api";
import {
  ContributePolicyEnum,
  OrgBindModeEnum,
  OrgJoinPolicyEnum,
  ProjectVisibilityEnum,
} from "@/lib/schemas";
import { resolveOrgBindOnCreate } from "@/lib/orgBinding";
import { reconcilePendingLicenses } from "@/lib/casting";

const optionalStr = z.string().trim().max(2000).optional().nullable();

const userCreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalStr,
  /** PRIVATE delivery (default) or PUBLIC co-creation entry under a column */
  visibility: ProjectVisibilityEnum.optional(),
  columnId: optionalStr,
  /** When creating a PUBLIC entry under a new column in one step — use /api/user/columns first */
  orgMode: OrgBindModeEnum.optional(),
  acnOrgId: optionalStr,
  orgJoinPolicy: OrgJoinPolicyEnum.optional(),
  contributePolicy: ContributePolicyEnum.optional(),
});

async function nextEntryOrder(columnId: string): Promise<number> {
  const latest = await prisma.project.findFirst({
    where: { columnId, entryOrder: { not: null } },
    orderBy: { entryOrder: "desc" },
    select: { entryOrder: true },
  });
  return (latest?.entryOrder ?? 0) + 1;
}

// 我的项目:列出当前登录用户名下的项目
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const projects = await prisma.project.findMany({
    where: { ownerUserId: sub },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      agentName: true,
      coverUrl: true,
      currentStage: true,
      shareToken: true,
      visibility: true,
      columnId: true,
      updatedAt: true,
    },
  });
  after(() => reconcilePendingLicenses(sub));
  return Response.json({ projects });
}

/**
 * Create a project owned by the signed-in user.
 * - PRIVATE: classic delivery cell
 * - PUBLIC: co-creation entry; must attach a column the user owns
 */
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  let body: z.infer<typeof userCreateProjectSchema>;
  try {
    body = await parseBody(req, userCreateProjectSchema);
  } catch (err) {
    return mapError(err);
  }

  const visibility = body.visibility ?? "PRIVATE";
  const columnId = body.columnId?.trim() || null;

  if (visibility === "PUBLIC" && !columnId) {
    return badRequest("PUBLIC co-creation projects require columnId");
  }
  if (visibility === "PRIVATE" && columnId) {
    return badRequest("PRIVATE projects cannot attach to a co-creation column");
  }

  if (columnId) {
    const column = await prisma.column.findUnique({
      where: { id: columnId },
      select: { id: true, ownerUserId: true },
    });
    if (!column) return notFoundJson("Column not found");
    if (column.ownerUserId !== sub) {
      return forbidden("You can only open PUBLIC entries under columns you own");
    }
  }

  const wantsOrgBind =
    body.orgMode != null || Boolean(body.acnOrgId?.trim());
  let acnOrgId: string | null = null;

  if (wantsOrgBind) {
    if (visibility !== "PUBLIC") {
      return badRequest("Org binding is only for PUBLIC co-creation projects");
    }
    const bind = await resolveOrgBindOnCreate({
      mode: body.orgMode,
      acnOrgId: body.acnOrgId,
      displayName: body.name,
      joinPolicy: body.orgJoinPolicy,
    });
    if (bind instanceof Response) return bind;
    acnOrgId = bind.acnOrgId;
  }

  const project = await withRetry(async () => {
    const entryOrder = columnId ? await nextEntryOrder(columnId) : null;
    return prisma.project.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        ownerUserId: sub,
        visibility,
        columnId,
        entryOrder,
        acnOrgId,
        contributePolicy: body.contributePolicy ?? null,
        ...(visibility === "PUBLIC" ? { isPrivate: false } : {}),
      },
    });
  });

  return Response.json(
    {
      id: project.id,
      shareToken: project.shareToken,
      sharePath: `/p/${project.shareToken}`,
      visibility: project.visibility,
      columnId: project.columnId,
      entryOrder: project.entryOrder,
      acnOrgId: project.acnOrgId,
    },
    { status: 201 }
  );
}
