import { prisma } from "@/lib/db";
import { badRequest, forbidden, serverError } from "@/lib/auth";
import {
  acnOrgConfigured,
  createAcnOrg,
  getAcnOrg,
  isAgentOrgMember,
  orgSubnetId,
} from "@/lib/acnOrg";

export type ContributePolicy = "org_members" | "open" | "owner_only";

export type OrgBindMode = "none" | "create" | "attach";

export type EffectiveOrgContext = {
  acnOrgId: string | null;
  contributePolicy: ContributePolicy;
  source: "project" | "column" | "none";
};

/** Resolve which Org gates a project (project override → column default → none). */
export async function resolveEffectiveOrg(
  projectId: string
): Promise<EffectiveOrgContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      acnOrgId: true,
      contributePolicy: true,
      column: {
        select: { acnOrgId: true, contributePolicy: true },
      },
    },
  });
  if (!project) {
    return { acnOrgId: null, contributePolicy: "org_members", source: "none" };
  }

  if (project.acnOrgId) {
    return {
      acnOrgId: project.acnOrgId,
      contributePolicy: normalizePolicy(
        project.contributePolicy ?? project.column?.contributePolicy
      ),
      source: "project",
    };
  }

  if (project.column?.acnOrgId) {
    return {
      acnOrgId: project.column.acnOrgId,
      contributePolicy: normalizePolicy(
        project.contributePolicy ?? project.column.contributePolicy
      ),
      source: "column",
    };
  }

  return {
    acnOrgId: null,
    contributePolicy: normalizePolicy(
      project.contributePolicy ?? project.column?.contributePolicy
    ),
    source: "none",
  };
}

function normalizePolicy(raw: string | null | undefined): ContributePolicy {
  if (raw === "open" || raw === "owner_only" || raw === "org_members") return raw;
  return "org_members";
}

export type ResolvedOrgBind = {
  acnOrgId: string | null;
  acnSubnetId: string | null;
};

/**
 * Create / attach / skip Org binding for a new Column or Project.
 * - none: no org
 * - create: POST /orgs via studio steward key
 * - attach: verify org exists
 */
export async function resolveOrgBindOnCreate(args: {
  mode?: OrgBindMode | null;
  acnOrgId?: string | null;
  displayName: string;
  stewardAgentId?: string | null;
  joinPolicy?: "open" | "approval";
}): Promise<ResolvedOrgBind | Response> {
  const mode: OrgBindMode =
    args.mode ??
    (args.acnOrgId?.trim() ? "attach" : "none");

  if (mode === "none") {
    return { acnOrgId: null, acnSubnetId: null };
  }

  if (mode === "attach") {
    const orgId = args.acnOrgId?.trim();
    if (!orgId) return badRequest("acnOrgId is required when orgMode=attach");
    try {
      const org = await getAcnOrg(orgId);
      if (!org) return badRequest(`ACN Org not found: ${orgId}`);
      return { acnOrgId: org.org_id, acnSubnetId: orgSubnetId(org) };
    } catch (err) {
      console.error("[orgBinding] getAcnOrg failed", err);
      return serverError("Failed to verify ACN Org");
    }
  }

  // create
  if (!acnOrgConfigured()) {
    return badRequest(
      "ACN Org is not configured on server (need ACN_API_URL + ACN_CHAT_API_KEY)"
    );
  }
  try {
    const org = await createAcnOrg({
      displayName: args.displayName,
      stewardAgentId: args.stewardAgentId?.trim() || undefined,
      joinPolicy: args.joinPolicy ?? "approval",
      isPrivate: false,
      charter: { mission: args.displayName },
    });
    return { acnOrgId: org.org_id, acnSubnetId: orgSubnetId(org) };
  } catch (err) {
    console.error("[orgBinding] createAcnOrg failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return badRequest(`Failed to create ACN Org: ${msg}`);
  }
}

/**
 * Gate agent content creation on PUBLIC/co-creation containers.
 * PRIVATE projects without org binding skip the check (classic pipeline).
 */
export async function assertAgentCanContribute(args: {
  projectId: string;
  projectVisibility: string;
  agentId: string | null;
  /** studio_key ops may bypass only when explicitly allowed */
  isStudioKey?: boolean;
  bearer?: string;
}): Promise<Response | null> {
  const effective = await resolveEffectiveOrg(args.projectId);

  if (effective.contributePolicy === "open") return null;

  if (!effective.acnOrgId) {
    // No org: open contribution for PUBLIC; PRIVATE stays classic (no gate)
    if (args.projectVisibility === "PUBLIC" && effective.contributePolicy === "owner_only") {
      return forbidden("This project only accepts contributions from the owner");
    }
    return null;
  }

  if (effective.contributePolicy === "owner_only") {
    return forbidden("This container only accepts owner contributions");
  }

  // org_members — humans are not OrgMembership; studio_key may attribute to a user
  if (!args.agentId) {
    if (args.isStudioKey) return null;
    return forbidden(
      "An authorAgentId is required to contribute when an ACN Org gates this container"
    );
  }

  try {
    const ok = await isAgentOrgMember(
      effective.acnOrgId,
      args.agentId,
      args.bearer
    );
    if (!ok) {
      return forbidden(
        `Agent ${args.agentId} is not an active member of Org ${effective.acnOrgId}`
      );
    }
    return null;
  } catch (err) {
    console.error("[orgBinding] membership check failed", err);
    // Fail closed for org-gated containers
    return serverError("Failed to verify ACN Org membership");
  }
}

/** Human contribute: owners always; open policy any PUBLIC user; org_members → PUBLIC users allowed (humans not in OrgMembership). */
export function assertHumanContributePolicy(args: {
  effective: EffectiveOrgContext;
  project: {
    visibility: string;
    ownerUserId: string | null;
  };
  sub: string;
}): Response | null {
  if (args.project.ownerUserId === args.sub) return null;

  if (args.effective.contributePolicy === "owner_only") {
    return forbidden("Only the owner can contribute to this container");
  }

  // open | org_members: humans use Studio visibility rules (caller already passed canUserContribute)
  return null;
}
