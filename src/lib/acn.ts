// ACN Task Pool 对接(官方内部生产线编排)。
//
// 钱不走 Escrow:use_escrow=false + AgentPlanet /wallet/charge。
// 建单身份固定为已注册的 **comiclaw-studio** agent(ACN_CHAT_API_KEY / ACN_CHAT_AGENT_ID)。
// ACN 已废止 system:task-invite;不要用人类 ID 建单。
// 任务挂 private subnet,建单后 invite 生产 Agent(可多候选 + 主 comiclaw fallback)。
// 客户 cell 不持有 ACN key。

const ACN_API_URL = () => (process.env.ACN_API_URL ?? "https://api.acnlabs.dev").trim().replace(/\/+$/, "");
/** comiclaw-studio 建单 agent 的 API key(历史名 CHAT;身份必须是 studio agent) */
const ACN_CHAT_API_KEY = () => (process.env.ACN_CHAT_API_KEY ?? "").trim();
/** comiclaw-studio 的 agent_id(如 90f884c1-…) */
const ACN_CHAT_AGENT_ID = () => (process.env.ACN_CHAT_AGENT_ID ?? "").trim();
const ACN_PROD_AGENT_ID = () => (process.env.ACN_PROD_AGENT_ID ?? "").trim();
const ACN_SUBNET_SLUG = () => (process.env.ACN_SUBNET_SLUG ?? "").trim();

let creatorIdentityCheckedAt = 0;
let creatorIdentityOk = false;
const CREATOR_IDENTITY_TTL_MS = 5 * 60 * 1000;

/** 确认 ACN_CHAT_API_KEY 对应 comiclaw-studio(ACN_CHAT_AGENT_ID),防止配错人类/其他 agent key */
async function assertStudioCreatorIdentity(): Promise<void> {
  const expected = ACN_CHAT_AGENT_ID();
  const key = ACN_CHAT_API_KEY();
  if (!expected || !key) {
    throw new Error("ACN_CHAT_API_KEY / ACN_CHAT_AGENT_ID required (comiclaw-studio agent)");
  }
  if (creatorIdentityOk && Date.now() - creatorIdentityCheckedAt < CREATOR_IDENTITY_TTL_MS) {
    return;
  }
  const res = await fetch(`${ACN_API_URL()}/api/v1/agents/me`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(
      `ACN creator identity check failed: cannot GET /agents/me with ACN_CHAT_API_KEY (HTTP ${res?.status ?? "network"})`
    );
  }
  const body = (await res.json().catch(() => null)) as {
    agent_id?: unknown;
    name?: unknown;
  } | null;
  const agentId = typeof body?.agent_id === "string" ? body.agent_id.trim() : "";
  if (!agentId) {
    throw new Error("ACN creator identity check failed: /agents/me missing agent_id");
  }
  if (agentId !== expected) {
    throw new Error(
      `ACN creator identity mismatch: key is agent ${agentId}, but ACN_CHAT_AGENT_ID=${expected} (must be comiclaw-studio)`
    );
  }
  creatorIdentityCheckedAt = Date.now();
  creatorIdentityOk = true;
}

export type AcnProductionType = "WRITE_SCRIPT" | "GENERATE_IMAGE";

export function acnProductionConfigured(): boolean {
  return Boolean(
    ACN_API_URL() &&
      ACN_CHAT_API_KEY() &&
      ACN_CHAT_AGENT_ID() &&
      ACN_PROD_AGENT_ID() &&
      ACN_SUBNET_SLUG()
  );
}

export function acnConfigSummary() {
  return {
    apiUrl: ACN_API_URL(),
    chatAgentId: ACN_CHAT_AGENT_ID() || null,
    prodAgentId: ACN_PROD_AGENT_ID() || null,
    subnetSlug: ACN_SUBNET_SLUG() || null,
    configured: acnProductionConfigured(),
  };
}

export function defaultProductionAgentId(): string {
  return ACN_PROD_AGENT_ID();
}

export interface AcnTask {
  task_id: string;
  title: string;
  description: string;
  status: string;
  creator_id: string;
  assignee_id?: string | null;
  subnet_slug?: string | null;
  use_escrow?: boolean;
  task_type?: string;
  metadata?: Record<string, unknown>;
  invited_agent_ids?: string[];
}

async function acnFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = ACN_CHAT_API_KEY();
  if (!key) throw new Error("ACN_CHAT_API_KEY is not configured");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${ACN_API_URL()}${path}`, { ...init, headers });
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { message?: string; detail?: string; error?: string };
    return j.message || j.detail || j.error || text.slice(0, 500) || `HTTP ${res.status}`;
  } catch {
    return text.slice(0, 500) || `HTTP ${res.status}`;
  }
}

export async function getAcnTask(taskId: string): Promise<AcnTask | null> {
  const res = await acnFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ACN get task failed: ${await readError(res)}`);
  return (await res.json()) as AcnTask;
}

export async function inviteAcnAgent(taskId: string, agentId: string): Promise<AcnTask> {
  const res = await acnFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}/invite`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!res.ok) throw new Error(`ACN invite failed: ${await readError(res)}`);
  return (await res.json()) as AcnTask;
}

/** invite 生产 Agent(可独立重试;private subnet 成员本就能看到任务) */
export async function inviteAcnProductionAgent(taskId: string): Promise<AcnTask> {
  return inviteAcnAgent(taskId, ACN_PROD_AGENT_ID());
}

/** 去重保序的 invite 列表 */
export function resolveWorkerInvitees(args: {
  workerAgentIds?: string[] | null;
  includeDefaultWorker?: boolean;
}): string[] {
  const includeDefault = args.includeDefaultWorker !== false;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const t = id.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const id of args.workerAgentIds ?? []) push(id);
  if (includeDefault) push(ACN_PROD_AGENT_ID());
  return out;
}

/** 仅建单,不 invite——调用方负责先落映射再尽力 invite */
export async function createAcnProductionTaskOnly(args: {
  type: AcnProductionType;
  projectId: string;
  projectName: string;
  ownerUserId: string;
  input: Record<string, unknown>;
  workerAgentIds?: string[] | null;
  includeDefaultWorker?: boolean;
}): Promise<{ task: AcnTask; inviteeIds: string[] }> {
  if (!acnProductionConfigured()) {
    throw new Error(
      "ACN production is not configured (need ACN_CHAT_API_KEY, ACN_CHAT_AGENT_ID, ACN_PROD_AGENT_ID, ACN_SUBNET_SLUG)"
    );
  }
  await assertStudioCreatorIdentity();

  const inviteeIds = resolveWorkerInvitees({
    workerAgentIds: args.workerAgentIds,
    includeDefaultWorker: args.includeDefaultWorker,
  });
  if (inviteeIds.length === 0) {
    throw new Error("No workers to invite: provide workerAgentIds or includeDefaultWorker=true");
  }

  const brief =
    typeof args.input.brief === "string"
      ? args.input.brief
      : typeof args.input.prompt === "string"
        ? args.input.prompt
        : args.projectName;
  const title = `[${args.type}] ${args.projectName}`.slice(0, 200);
  // ACN description 最少 10 字符
  const description = [
    `Studio production task (${args.type}).`,
    `project_id=${args.projectId}`,
    `owner=${args.ownerUserId}`,
    `workers=${inviteeIds.join(",")}`,
    "",
    brief,
  ]
    .join("\n")
    .slice(0, 10_000);

  if (description.trim().length < 10) {
    throw new Error("Task description too short");
  }

  // max_participants=1:多人被 invite,先 accept 的一人干活(主 comiclaw 作 fallback)
  const body = {
    title,
    description,
    deadline_hours: 72,
    reward: "0",
    reward_currency: "credits",
    use_escrow: false,
    auto_approve: true,
    max_participants: 1,
    task_type: args.type === "WRITE_SCRIPT" ? "comiclaw_write_script" : "comiclaw_generate_image",
    required_tags: ["comiclaw", "internal", args.type.toLowerCase()],
    subnet_slug: ACN_SUBNET_SLUG(),
    metadata: {
      studio: {
        project_id: args.projectId,
        owner_user_id: args.ownerUserId,
        type: args.type,
        input: args.input,
        charge_idempotency_key_prefix: "comiclaw:gen:",
        worker_agent_ids: inviteeIds,
      },
      creator_agent_id: ACN_CHAT_AGENT_ID(),
      // 兼容旧工人 skill:主候选放第一个;完整列表见 worker_agent_ids
      worker_agent_id: inviteeIds[0],
      worker_agent_ids: inviteeIds,
    },
  };

  const res = await acnFetch("/api/v1/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ACN create task failed: ${await readError(res)}`);
  const task = (await res.json()) as AcnTask;
  return { task, inviteeIds };
}
