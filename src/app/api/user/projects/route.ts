import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, notFoundJson, forbidden, tooManyRequests } from "@/lib/auth";
import { mapError, parseBody, withRetry } from "@/lib/api";
import {
  ContributePolicyEnum,
  OrgBindModeEnum,
  OrgJoinPolicyEnum,
  ProjectFormatEnum,
  ProjectVisibilityEnum,
} from "@/lib/schemas";
import { canDeriveFrom, DERIVATION_ERRORS } from "@/lib/derivativeProject";
import { coCreationData, declaresOwnGovernance } from "@/lib/coCreation";
import { resolveOrgBindOnCreate } from "@/lib/orgBinding";
import { reconcilePendingLicenses } from "@/lib/casting";
import { maxOrgCreatesPerDay, startOfUtcDay } from "@/lib/columnQuota";
import { ownerFields, ownerFromRecord, resolveCreateOwner } from "@/lib/owner";
import { ensureUserProfile } from "@/lib/userHandle";
import {
  dramaEpisodeCreateData,
  invalidDramaCreate,
  loadDramaShell,
  nextDramaOrder,
  parseProjectFormat,
  PROJECT_FORMAT_DRAMA,
} from "@/lib/dramaProject";

const optionalStr = z.string().trim().max(2000).optional().nullable();

const userCreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalStr,
  /** PRIVATE delivery (default) or PUBLIC standalone collab project */
  visibility: ProjectVisibilityEnum.optional(),
  format: ProjectFormatEnum.optional(),
  /** Official 记 only: attach to a column the user owns. Not required for collab. */
  columnId: optionalStr,
  /** Belong to a 漫剧 the user owns. The new project is one episode. */
  dramaProjectId: optionalStr,
  /** Set to build your own co-creation project under someone else's entry */
  parentProjectId: optionalStr,
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
    where: { ownerKind: "user", ownerUserId: sub, dramaProjectId: null },
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
      format: true,
      columnId: true,
      updatedAt: true,
      _count: { select: { dramaEpisodes: true } },
    },
  });
  after(() => reconcilePendingLicenses(sub));
  return Response.json({
    projects: projects.map(({ _count, ...p }) => ({
      ...p,
      episodeCount: _count.dramaEpisodes,
    })),
  });
}

// 在别人开的一记下面开自己的共创项目。项目归本人所有,栏目与策略从那一记继承。
async function createDerivative(
  sub: string,
  body: z.infer<typeof userCreateProjectSchema>,
  parentProjectId: string
) {
  const parent = await prisma.project.findUnique({
    where: { id: parentProjectId },
    select: {
      id: true,
      visibility: true,
      columnId: true,
      parentProjectId: true,
      contributePolicy: true,
      column: { select: { contributePolicy: true, ownerUserId: true } },
    },
  });
  if (!parent) return notFoundJson("Parent project not found");

  if (declaresOwnGovernance(body)) {
    return badRequest("A co-creation project inherits the entry's Org and policy");
  }

  const allowed = canDeriveFrom({
    parent,
    contributePolicy: parent.contributePolicy ?? parent.column?.contributePolicy ?? null,
    deriver: { kind: "user", sub, ownsColumn: parent.column?.ownerUserId === sub },
  });
  if (!allowed.ok) return forbidden(DERIVATION_ERRORS[allowed.reason]);

  const owner = resolveCreateOwner({ actor: { kind: "user", userId: sub } });
  await ensureUserProfile(sub);
  const project = await prisma.project.create({
    data: coCreationData(parent, {
      name: body.name,
      description: body.description,
      ...ownerFields(owner),
    }),
  });

  return Response.json(
    {
      id: project.id,
      shareToken: project.shareToken,
      sharePath: `/p/${project.shareToken}`,
      visibility: project.visibility,
      columnId: project.columnId,
      parentProjectId: project.parentProjectId,
    },
    { status: 201 }
  );
}

/**
 * Create a project owned by the signed-in user.
 * - PRIVATE: classic delivery cell
 * - PUBLIC: standalone collab project (own theme; optional ACN Org)
 * - format=DRAMA: 漫剧壳,集另加
 * - dramaProjectId: 一部漫剧下的一集
 * - columnId + PUBLIC: official 记 under a column the user owns
 * - parentProjectId: a co-creation project under someone else's entry
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

  const parentProjectId = body.parentProjectId?.trim() || null;
  if (parentProjectId) return createDerivative(sub, body, parentProjectId);

  const visibility = body.visibility ?? "PRIVATE";
  const columnId = body.columnId?.trim() || null;
  const dramaProjectId = body.dramaProjectId?.trim() || null;
  const format = parseProjectFormat(body.format);

  const dramaError = invalidDramaCreate({
    format,
    dramaProjectId,
    columnId,
    parentProjectId,
  });
  if (dramaError) return badRequest(dramaError);

  if (visibility === "PRIVATE" && columnId) {
    return badRequest("PRIVATE projects cannot attach to a column");
  }
  if (body.orgMode === "attach" || body.acnOrgId?.trim()) {
    return badRequest(
      "orgMode=attach is not available for user-created projects; use create or none"
    );
  }

  if (dramaProjectId) {
    if (body.orgMode != null) {
      return badRequest("A drama episode inherits the show's Org and policy");
    }
    const shell = await loadDramaShell(dramaProjectId);
    if (!shell) return notFoundJson("Drama project not found");
    if (ownerFromRecord(shell).ownerKind !== "user" || shell.ownerUserId !== sub) {
      return forbidden("You can only add episodes to a drama you own");
    }
    await ensureUserProfile(sub);
    const project = await withRetry(async () => {
      const dramaOrder = await nextDramaOrder(dramaProjectId);
      return prisma.project.create({
        data: dramaEpisodeCreateData(
          shell,
          { name: body.name, description: body.description },
          dramaOrder,
        ),
      });
    });
    return Response.json(
      {
        id: project.id,
        shareToken: project.shareToken,
        sharePath: `/p/${project.shareToken}`,
        visibility: project.visibility,
        format: project.format,
        dramaProjectId: project.dramaProjectId,
        dramaOrder: project.dramaOrder,
      },
      { status: 201 },
    );
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

  const wantsOrgCreate = body.orgMode === "create";
  let acnOrgId: string | null = null;

  if (wantsOrgCreate || body.orgMode === "none") {
    if (visibility !== "PUBLIC") {
      return badRequest("Org binding is only for PUBLIC collab projects");
    }
  }

  if (wantsOrgCreate) {
    const since = startOfUtcDay();
    const [columnOrgs, projectOrgs] = await Promise.all([
      prisma.column.count({
        where: { ownerUserId: sub, orgCreatedAt: { gte: since } },
      }),
      prisma.project.count({
        where: {
          ownerUserId: sub,
          acnOrgId: { not: null },
          createdAt: { gte: since },
        },
      }),
    ]);
    const limit = maxOrgCreatesPerDay();
    if (columnOrgs + projectOrgs >= limit) {
      return tooManyRequests(
        `Daily limit of ${limit} new collaboration Orgs reached; retry after 00:00 UTC or create with orgMode=none`
      );
    }
    const bind = await resolveOrgBindOnCreate({
      mode: "create",
      displayName: body.name,
      joinPolicy: body.orgJoinPolicy,
    });
    if (bind instanceof Response) return bind;
    acnOrgId = bind.acnOrgId;
  }

  const contributePolicy =
    body.contributePolicy ??
    (wantsOrgCreate ? "org_members" : visibility === "PUBLIC" && !columnId ? "open" : null);

  const owner = resolveCreateOwner({ actor: { kind: "user", userId: sub } });
  await ensureUserProfile(sub);

  const project = await withRetry(async () => {
    const entryOrder = columnId ? await nextEntryOrder(columnId) : null;
    return prisma.project.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        ...ownerFields(owner),
        visibility,
        format,
        columnId: format === PROJECT_FORMAT_DRAMA ? null : columnId,
        entryOrder: format === PROJECT_FORMAT_DRAMA ? null : entryOrder,
        acnOrgId,
        contributePolicy,
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
      format: project.format,
      columnId: project.columnId,
      entryOrder: project.entryOrder,
      acnOrgId: project.acnOrgId,
    },
    { status: 201 }
  );
}
