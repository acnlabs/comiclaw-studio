export const OWNER_KINDS = ["user", "agent", "org"] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

export type ProjectOwner = {
  ownerKind: OwnerKind;
  ownerUserId: string | null;
  ownerAgentId: string | null;
  ownerOrgId: string | null;
};

export function isOwnerKind(value: string | null | undefined): value is OwnerKind {
  return value === "user" || value === "agent" || value === "org";
}

function trimId(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id || null;
}

function studioFallbackAgentId(): string | null {
  return (
    trimId(process.env.ACN_PROD_AGENT_ID) ??
    trimId(process.env.ACN_CHAT_AGENT_ID)
  );
}

/** 创建时定东家:人 / agent / 组织。协作围栏 acnOrgId 不是所有权。 */
export function resolveCreateOwner(args: {
  requested?: {
    kind?: string | null;
    userId?: string | null;
    agentId?: string | null;
    orgId?: string | null;
  };
  actor:
    | { kind: "user"; userId: string }
    | { kind: "agent"; agentId: string }
    | { kind: "studio_key" };
}): ProjectOwner {
  const userId = trimId(args.requested?.userId);
  const agentId = trimId(args.requested?.agentId);
  const orgId = trimId(args.requested?.orgId);
  const kind = isOwnerKind(args.requested?.kind) ? args.requested!.kind : null;

  if (kind === "org" && orgId) {
    return { ownerKind: "org", ownerUserId: null, ownerAgentId: null, ownerOrgId: orgId };
  }
  if (kind === "user" && userId) {
    return { ownerKind: "user", ownerUserId: userId, ownerAgentId: null, ownerOrgId: null };
  }
  if (kind === "agent" && agentId) {
    return { ownerKind: "agent", ownerUserId: null, ownerAgentId: agentId, ownerOrgId: null };
  }
  if (userId) {
    return { ownerKind: "user", ownerUserId: userId, ownerAgentId: null, ownerOrgId: null };
  }
  if (orgId && kind === "org") {
    return { ownerKind: "org", ownerUserId: null, ownerAgentId: null, ownerOrgId: orgId };
  }

  if (args.actor.kind === "user") {
    return {
      ownerKind: "user",
      ownerUserId: args.actor.userId,
      ownerAgentId: null,
      ownerOrgId: null,
    };
  }
  if (args.actor.kind === "agent") {
    return {
      ownerKind: "agent",
      ownerUserId: null,
      ownerAgentId: args.actor.agentId,
      ownerOrgId: null,
    };
  }
  return {
    ownerKind: "agent",
    ownerUserId: null,
    ownerAgentId: agentId ?? studioFallbackAgentId(),
    ownerOrgId: null,
  };
}

export function ownerFields(owner: ProjectOwner) {
  return {
    ownerKind: owner.ownerKind,
    ownerUserId: owner.ownerUserId,
    ownerAgentId: owner.ownerAgentId,
    ownerOrgId: owner.ownerOrgId,
  };
}

export type OwnerActor =
  | { kind: "user"; userId: string }
  | { kind: "agent"; agentId: string }
  | { kind: "studio_key" };

export function ownerFromRecord(row: {
  ownerKind?: string | null;
  ownerUserId: string | null;
  ownerAgentId?: string | null;
  ownerOrgId?: string | null;
}): ProjectOwner {
  if (isOwnerKind(row.ownerKind)) {
    return {
      ownerKind: row.ownerKind,
      ownerUserId: row.ownerUserId,
      ownerAgentId: row.ownerAgentId ?? null,
      ownerOrgId: row.ownerOrgId ?? null,
    };
  }
  if (row.ownerUserId) {
    return {
      ownerKind: "user",
      ownerUserId: row.ownerUserId,
      ownerAgentId: null,
      ownerOrgId: null,
    };
  }
  return {
    ownerKind: "agent",
    ownerUserId: null,
    ownerAgentId: row.ownerAgentId ?? null,
    ownerOrgId: row.ownerOrgId ?? null,
  };
}

export type ClaimViaShareLink =
  | { ok: true }
  | { ok: false; alreadyOwned: true }
  | { ok: false; reason: "public" | "owned_by_other" };

/**
 * 持有分享链接的登录用户能否把项目收到自己名下。
 * 无主私有单、以及官方/agent 代建（还没有人东家）的私有单可以认领。
 * 已有别人或组织东家、PUBLIC 共创，不能抢。
 */
export function decideClaimViaShareLink(
  row: {
    ownerKind?: string | null;
    ownerUserId: string | null;
    ownerAgentId?: string | null;
    ownerOrgId?: string | null;
  },
  visibility: string,
  sub: string,
): ClaimViaShareLink {
  if (visibility === "PUBLIC") return { ok: false, reason: "public" };
  const owner = ownerFromRecord(row);
  if (owner.ownerKind === "user" && owner.ownerUserId) {
    if (owner.ownerUserId === sub) return { ok: false, alreadyOwned: true };
    return { ok: false, reason: "owned_by_other" };
  }
  if (owner.ownerKind === "org" && owner.ownerOrgId) {
    return { ok: false, reason: "owned_by_other" };
  }
  return { ok: true };
}

/** 东家已经定了:人 / agent / 组织三者有一个对得上。无主的旧私有单可以认领。 */
export function hasSettledOwner(row: {
  ownerKind?: string | null;
  ownerUserId: string | null;
  ownerAgentId?: string | null;
  ownerOrgId?: string | null;
}): boolean {
  const owner = ownerFromRecord(row);
  if (owner.ownerKind === "user") return Boolean(owner.ownerUserId);
  if (owner.ownerKind === "agent") return Boolean(owner.ownerAgentId);
  return Boolean(owner.ownerOrgId);
}

export function ownersMatch(a: ProjectOwner, b: ProjectOwner): boolean {
  if (a.ownerKind !== b.ownerKind) return false;
  if (a.ownerKind === "user") {
    return Boolean(a.ownerUserId && a.ownerUserId === b.ownerUserId);
  }
  if (a.ownerKind === "agent") {
    return Boolean(a.ownerAgentId && a.ownerAgentId === b.ownerAgentId);
  }
  return Boolean(a.ownerOrgId && a.ownerOrgId === b.ownerOrgId);
}

export function ownerEqualsWhere(owner: ProjectOwner) {
  if (owner.ownerKind === "user" && owner.ownerUserId) {
    return { ownerKind: "user" as const, ownerUserId: owner.ownerUserId };
  }
  if (owner.ownerKind === "agent" && owner.ownerAgentId) {
    return { ownerKind: "agent" as const, ownerAgentId: owner.ownerAgentId };
  }
  if (owner.ownerKind === "org" && owner.ownerOrgId) {
    return { ownerKind: "org" as const, ownerOrgId: owner.ownerOrgId };
  }
  return null;
}

/**
 * Agent 不能把东家写成别人的 agent。写成组织时,调用方还要再查成员资格
 * (或本次刚建的 Org)。Studio key / 人请 agent 做不受限。
 */
export function createOwnerAssignmentError(
  owner: ProjectOwner,
  actor: OwnerActor,
  opts?: { allowedOrgIds?: string[] },
): string | null {
  if (actor.kind === "studio_key") return null;
  if (actor.kind === "user") {
    if (owner.ownerKind !== "user" || owner.ownerUserId !== actor.userId) {
      return "A signed-in user can only create projects they own";
    }
    return null;
  }
  if (owner.ownerKind === "user") return null;
  if (owner.ownerKind === "agent") {
    if (owner.ownerAgentId !== actor.agentId) {
      return "An agent cannot assign another agent as owner";
    }
    return null;
  }
  if (owner.ownerOrgId && opts?.allowedOrgIds?.includes(owner.ownerOrgId)) {
    return null;
  }
  return "ORG_MEMBERSHIP_REQUIRED";
}
