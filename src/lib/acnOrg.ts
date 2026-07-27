/**
 * ACN Org Harness client (external co-creation orgs).
 * Separate from internal Task Pool production (acn.ts / comiclaw-internal).
 */

const ACN_API_URL = () =>
  (process.env.ACN_API_URL ?? "https://api.acnlabs.dev").trim().replace(/\/+$/, "");
const ACN_CHAT_API_KEY = () => (process.env.ACN_CHAT_API_KEY ?? "").trim();
const ACN_CHAT_AGENT_ID = () => (process.env.ACN_CHAT_AGENT_ID ?? "").trim();
/** Optional dedicated steward when humans create orgs without their own agent */
const ACN_ORG_STEWARD_AGENT_ID = () =>
  (process.env.ACN_ORG_STEWARD_AGENT_ID ?? ACN_CHAT_AGENT_ID()).trim();

export function acnOrgConfigured(): boolean {
  return Boolean(ACN_API_URL() && ACN_CHAT_API_KEY() && ACN_ORG_STEWARD_AGENT_ID());
}

export function defaultOrgStewardAgentId(): string {
  return ACN_ORG_STEWARD_AGENT_ID();
}

export type AcnOrg = {
  org_id: string;
  display_name: string;
  subnet_id?: string;
  fencing?: { subnet_id?: string };
  status?: string;
};

export type AcnOrgMember = {
  org_id: string;
  agent_id: string;
  role: string;
  status: string;
};

async function orgFetch(
  path: string,
  init: RequestInit = {},
  bearer?: string
): Promise<Response> {
  const key = (bearer ?? ACN_CHAT_API_KEY()).trim();
  if (!key) throw new Error("ACN API key is not configured for Org calls");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${ACN_API_URL()}${path}`, { ...init, headers, cache: "no-store" });
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as {
      message?: string;
      detail?: string | { reason?: string };
      error?: string;
    };
    if (typeof j.detail === "string") return j.detail;
    return j.message || j.error || text.slice(0, 500) || `HTTP ${res.status}`;
  } catch {
    return text.slice(0, 500) || `HTTP ${res.status}`;
  }
}

export async function createAcnOrg(args: {
  displayName: string;
  stewardAgentId?: string;
  joinPolicy?: "open" | "approval";
  isPrivate?: boolean;
  charter?: Record<string, unknown>;
  bearer?: string;
}): Promise<AcnOrg> {
  const steward = (args.stewardAgentId ?? defaultOrgStewardAgentId()).trim();
  if (!steward) {
    throw new Error("steward_agent_id required to create ACN Org");
  }
  const res = await orgFetch(
    "/api/v1/orgs",
    {
      method: "POST",
      body: JSON.stringify({
        display_name: args.displayName,
        steward_agent_id: steward,
        join_policy: args.joinPolicy ?? "approval",
        is_private: args.isPrivate ?? false,
        charter: args.charter ?? undefined,
      }),
    },
    args.bearer
  );
  if (!res.ok) {
    throw new Error(`ACN create org failed: ${await readError(res)}`);
  }
  return (await res.json()) as AcnOrg;
}

export async function getAcnOrg(
  orgId: string,
  bearer?: string
): Promise<AcnOrg | null> {
  const res = await orgFetch(`/api/v1/orgs/${encodeURIComponent(orgId)}`, {}, bearer);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ACN get org failed: ${await readError(res)}`);
  return (await res.json()) as AcnOrg;
}

export async function listAcnOrgMembers(
  orgId: string,
  bearer?: string
): Promise<AcnOrgMember[]> {
  const res = await orgFetch(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/members`,
    {},
    bearer
  );
  if (!res.ok) throw new Error(`ACN list org members failed: ${await readError(res)}`);
  const body = (await res.json()) as
    | AcnOrgMember[]
    | { members?: AcnOrgMember[] };
  if (Array.isArray(body)) return body;
  return body.members ?? [];
}

export async function isAgentOrgMember(
  orgId: string,
  agentId: string,
  bearer?: string
): Promise<boolean> {
  const members = await listAcnOrgMembers(orgId, bearer);
  return members.some(
    (m) =>
      m.agent_id === agentId &&
      (m.status === "active" || m.status === undefined || m.status === "")
  );
}

export async function addAcnOrgMember(args: {
  orgId: string;
  agentId: string;
  role?: string;
  bearer?: string;
}): Promise<AcnOrgMember> {
  const res = await orgFetch(
    `/api/v1/orgs/${encodeURIComponent(args.orgId)}/members`,
    {
      method: "POST",
      body: JSON.stringify({
        agent_id: args.agentId,
        role: args.role ?? "worker",
      }),
    },
    args.bearer
  );
  if (!res.ok) {
    throw new Error(`ACN add org member failed: ${await readError(res)}`);
  }
  return (await res.json()) as AcnOrgMember;
}

export function orgSubnetId(org: AcnOrg): string | null {
  return org.subnet_id || org.fencing?.subnet_id || null;
}
