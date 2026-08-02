import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, withAgentAuth, withRetry, mapError } from "@/lib/api";
import { authenticateStudioOrAcnAgent } from "@/lib/acnAuth";
import { badRequest, extractBearer, forbidden, notFoundJson } from "@/lib/auth";
import { canOpenEntry, ENTRY_OPEN_ERRORS } from "@/lib/columnEditor";
import { canDeriveFrom, DERIVATION_ERRORS } from "@/lib/derivativeProject";
import { createProjectSchema } from "@/lib/schemas";
import { assertAgentCanContribute, resolveOrgBindOnCreate } from "@/lib/orgBinding";

async function nextEntryOrder(columnId: string): Promise<number> {
  const latest = await prisma.project.findFirst({
    where: { columnId, entryOrder: { not: null } },
    orderBy: { entryOrder: "desc" },
    select: { entryOrder: true },
  });
  return (latest?.entryOrder ?? 0) + 1;
}

type StudioOrAgent = Awaited<ReturnType<typeof authenticateStudioOrAcnAgent>>;

// 在一记下面开自己的二创 / 共创项目。项目归发起方所有,不是往官方项目里投稿。
async function createDerivative(
  req: Request,
  identity: Exclude<StudioOrAgent, Response>,
  body: z.infer<typeof createProjectSchema>,
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
      column: { select: { contributePolicy: true } },
    },
  });
  if (!parent) return notFoundJson("Parent project not found");

  // 二创项目从这一记继承 Org 与策略,不能自带
  if (body.orgMode != null || body.acnOrgId?.trim() || body.contributePolicy) {
    return badRequest("A co-creation project inherits the entry's Org and policy");
  }
  if (body.entryOrder != null) {
    return badRequest("Only the entry itself carries an entryOrder");
  }

  const isStudioKey = identity.kind === "studio_key";
  let gatePassed = isStudioKey;
  if (!isStudioKey) {
    const refused = await assertAgentCanContribute({
      projectId: parent.id,
      projectVisibility: parent.visibility,
      agentId: identity.agentId,
      isStudioKey: false,
      bearer: extractBearer(req) ?? undefined,
    });
    gatePassed = refused == null;
  }

  const allowed = canDeriveFrom({
    parent,
    contributePolicy: parent.contributePolicy ?? parent.column?.contributePolicy ?? null,
    deriver: isStudioKey ? { kind: "studio_key" } : { kind: "agent", gatePassed },
  });
  if (!allowed.ok) return forbidden(DERIVATION_ERRORS[allowed.reason]);

  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientName: body.clientName ?? null,
      agentName: body.agentName ?? null,
      description: body.description ?? null,
      coverUrl: body.coverUrl ?? null,
      ownerUserId: body.ownerUserId ?? null,
      visibility: "PUBLIC",
      isPrivate: false,
      columnId: parent.columnId,
      entryOrder: null,
      parentProjectId: parent.id,
    },
  });

  return Response.json(
    {
      id: project.id,
      shareToken: project.shareToken,
      sharePath: `/p/${project.shareToken}`,
      visibility: project.visibility,
      columnId: project.columnId,
      entryOrder: null,
      parentProjectId: project.parentProjectId,
    },
    { status: 201 }
  );
}

// 创建项目;可选新建/挂载 ACN Org(可覆盖栏目默认)。
// 鉴权:Studio key 全权;栏目的编辑 agent 可以用自己的 ACN 身份开本栏目的
// PUBLIC 一记——日更的第一步不该锁在全权运维密钥后面。
// 带 parentProjectId 时走另一条路:在别人开的一记下面开自己的共创项目。
export async function POST(req: Request) {
  const identity = await authenticateStudioOrAcnAgent(req);
  if (identity instanceof Response) return identity;

  let body: z.infer<typeof createProjectSchema>;
  try {
    body = await parseBody(req, createProjectSchema);
  } catch (err) {
    return mapError(err);
  }
  const parentProjectId = body.parentProjectId?.trim() || null;
  if (parentProjectId) {
    return createDerivative(req, identity, body, parentProjectId);
  }

  const visibility = body.visibility ?? "PRIVATE";
  const columnId = body.columnId?.trim() || null;

  let column: { editorAgentId: string | null } | null = null;
  if (columnId) {
    column = await prisma.column.findUnique({
      where: { id: columnId },
      select: { editorAgentId: true },
    });
    if (!column) return notFoundJson("Column not found");
  } else if (body.entryOrder != null) {
    return badRequest("entryOrder requires columnId");
  }

  const wantsOrgBind =
    body.orgMode != null || Boolean(body.acnOrgId?.trim());

  const allowed = canOpenEntry({
    request: { visibility, columnId, wantsOrgBind },
    column,
    opener:
      identity.kind === "studio_key"
        ? { kind: "studio_key" }
        : { kind: "agent", agentId: identity.agentId },
  });
  if (!allowed.ok) return forbidden(ENTRY_OPEN_ERRORS[allowed.reason]);
  let acnOrgId: string | null = null;
  let bindSubnet: string | null = null;

  if (wantsOrgBind) {
    const bind = await resolveOrgBindOnCreate({
      mode: body.orgMode,
      acnOrgId: body.acnOrgId,
      displayName: body.name,
      stewardAgentId: body.stewardAgentId,
      joinPolicy: body.orgJoinPolicy,
    });
    if (bind instanceof Response) return bind;
    acnOrgId = bind.acnOrgId;
    bindSubnet = bind.acnSubnetId;
  }

  const project = await withRetry(async () => {
    const entryOrder =
      columnId == null
        ? null
        : body.entryOrder !== undefined && body.entryOrder !== null
          ? body.entryOrder
          : await nextEntryOrder(columnId);

    return prisma.project.create({
      data: {
        name: body.name,
        clientName: body.clientName ?? null,
        agentName: body.agentName ?? null,
        description: body.description ?? null,
        coverUrl: body.coverUrl ?? null,
        ownerUserId: body.ownerUserId ?? null,
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
      acnSubnetId: bindSubnet,
      contributePolicy: project.contributePolicy,
    },
    { status: 201 }
  );
}

// 项目列表
export const GET = withAgentAuth(async (req) => {
  const url = new URL(req.url);
  const visibility = url.searchParams.get("visibility");
  const columnId = url.searchParams.get("columnId");
  const projects = await prisma.project.findMany({
    where: {
      ...(visibility === "PUBLIC" || visibility === "PRIVATE"
        ? { visibility }
        : {}),
      ...(columnId ? { columnId } : {}),
    },
    orderBy: [{ entryOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      clientName: true,
      agentName: true,
      currentStage: true,
      shareToken: true,
      visibility: true,
      columnId: true,
      entryOrder: true,
      acnOrgId: true,
      contributePolicy: true,
      updatedAt: true,
    },
  });
  return Response.json({ projects });
});
