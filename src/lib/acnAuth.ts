// ACN 智能体身份认证 + 生产任务绑定授权。
//
// 开放工人不持有 STUDIO_API_KEY,而是用自己的 ACN API key(或短时 JWT)。
// Studio 作为 ACN resource server:
//   AuthN = 调 ACN GET /agents/me(或后续验 JWT)得到 agent_id
//   AuthZ = 该 agent 必须是对应 AcnTask 的 assignee/invitee,且任务映射到目标项目

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { checkApiKey, extractBearer, unauthorized, forbidden, badRequest } from "@/lib/auth";
import { getAcnTask, type AcnTask } from "@/lib/acn";

const ACN_API_URL = () =>
  (process.env.ACN_API_URL ?? "https://api.acnlabs.dev").trim().replace(/\/+$/, "");

/** 工人请求必须带的任务绑定头(Studio 全局 key 不需要) */
export const ACN_TASK_HEADER = "x-acn-task-id";

export type ProductionAuth =
  | { kind: "studio_key" }
  | { kind: "acn_worker"; agentId: string; acnTaskId: string };

export type WorkerAccess = "read" | "write";

/** 终态:写接口拒绝;读接口仍允许(便于 submit 后对账) */
const TERMINAL_TASK_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "expired",
  "completed",
  "submitted",
  "approved",
  "done",
  "closed",
  "failed",
]);

type MeCacheEntry = { agentId: string; exp: number };
const meCache = new Map<string, MeCacheEntry>();
const ME_TTL_MS = 60_000;

function cacheKeyForToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 用调用方自己的 Bearer 问 ACN「我是谁」 */
export async function resolveAcnAgentId(bearer: string): Promise<string | null> {
  const ck = cacheKeyForToken(bearer);
  const hit = meCache.get(ck);
  if (hit && hit.exp > Date.now()) return hit.agentId;

  const res = await fetch(`${ACN_API_URL()}/api/v1/agents/me`, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;

  const body = (await res.json().catch(() => null)) as { agent_id?: unknown } | null;
  const agentId = typeof body?.agent_id === "string" ? body.agent_id.trim() : "";
  if (!agentId) return null;

  meCache.set(ck, { agentId, exp: Date.now() + ME_TTL_MS });
  return agentId;
}

export function readAcnTaskIdHeader(req: Request): string | null {
  const v = req.headers.get(ACN_TASK_HEADER)?.trim();
  return v || null;
}

/** 从 metadata 提取建单时的工人白名单(有则强制执行) */
export function intendedWorkerIds(task: AcnTask): string[] {
  const meta = task.metadata ?? {};
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v !== "string") return;
    const t = v.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  const workers = meta.worker_agent_ids;
  if (Array.isArray(workers)) for (const w of workers) push(w);
  const studio = meta.studio;
  if (studio && typeof studio === "object") {
    const studioWorkers = (studio as { worker_agent_ids?: unknown }).worker_agent_ids;
    if (Array.isArray(studioWorkers)) for (const w of studioWorkers) push(w);
  }
  // 仅有单数字段时也视为白名单(旧单 / 兼容)
  if (out.length === 0 && typeof meta.worker_agent_id === "string") {
    push(meta.worker_agent_id);
  }
  return out;
}

/**
 * 该 ACN agent 是否被授权操作此任务。
 * - 若 metadata 带工人白名单:只认名单(防 includeDefaultWorker=false 时
 *   subnet 内主 comiclaw 抢 accept 后仍可写 Studio)
 * - 无白名单的旧任务:assignee / invitee / worker_agent_id 兼容
 */
export function agentAuthorizedOnAcnTask(agentId: string, task: AcnTask): boolean {
  const allowlist = intendedWorkerIds(task);
  if (allowlist.length > 0) {
    return allowlist.includes(agentId);
  }

  if (task.assignee_id && task.assignee_id === agentId) return true;
  if ((task.invited_agent_ids ?? []).includes(agentId)) return true;
  const meta = task.metadata ?? {};
  if (typeof meta.worker_agent_id === "string" && meta.worker_agent_id === agentId) {
    return true;
  }
  return false;
}

export function taskStatusAllowsAccess(status: string | undefined | null, access: WorkerAccess): boolean {
  const s = (status || "").toLowerCase();
  if (!s) return true;
  if (access === "read") return true;
  return !TERMINAL_TASK_STATUSES.has(s);
}

/** 仅认证(定价/ping/防枚举前置):Studio key 或任意有效 ACN agent */
export async function authenticateStudioOrAcnAgent(
  req: Request
): Promise<{ kind: "studio_key" } | { kind: "acn_agent"; agentId: string } | Response> {
  if (checkApiKey(req)) return { kind: "studio_key" };
  const bearer = extractBearer(req);
  if (!bearer) return unauthorized();
  const agentId = await resolveAcnAgentId(bearer);
  if (!agentId) return unauthorized();
  return { kind: "acn_agent", agentId };
}

/**
 * 已确认是 ACN agent 后的任务绑定授权。
 */
export async function authorizeAcnWorkerForProject(
  req: Request,
  projectId: string,
  agentId: string,
  opts?: { acnTaskId?: string | null; access?: WorkerAccess }
): Promise<ProductionAuth | Response> {
  const access: WorkerAccess = opts?.access ?? "write";
  const acnTaskId = (opts?.acnTaskId ?? readAcnTaskIdHeader(req) ?? "").trim();
  if (!acnTaskId) {
    return badRequest(
      `ACN workers must send ${ACN_TASK_HEADER} bound to an assigned Studio production task`
    );
  }

  const ref = await prisma.acnTaskRef.findUnique({ where: { acnTaskId } });
  if (!ref || ref.projectId !== projectId) {
    return forbidden("ACN task is not mapped to this project");
  }

  let task: AcnTask | null;
  try {
    task = await getAcnTask(acnTaskId);
  } catch (err) {
    console.error("[acnAuth] getAcnTask failed:", err);
    return Response.json({ error: "Failed to verify ACN task assignment" }, { status: 502 });
  }
  if (!task) return forbidden("ACN task not found");

  if (!taskStatusAllowsAccess(task.status, access)) {
    return forbidden(`ACN task status '${task.status}' does not allow Studio ${access}s`);
  }

  if (!agentAuthorizedOnAcnTask(agentId, task)) {
    return forbidden("ACN agent is not invited/assigned to this task");
  }

  return { kind: "acn_worker", agentId, acnTaskId };
}

/**
 * 解析生产调用方(upload 等未走 wrapper 的路由):
 * - STUDIO_API_KEY → 官方全权限(无需任务绑定)
 * - 否则按 ACN Bearer 解析 agent,并校验任务↔项目绑定
 */
export async function authorizeProjectWorker(
  req: Request,
  projectId: string,
  opts?: { acnTaskId?: string | null; access?: WorkerAccess }
): Promise<ProductionAuth | Response> {
  const identity = await authenticateStudioOrAcnAgent(req);
  if (identity instanceof Response) return identity;
  if (identity.kind === "studio_key") return { kind: "studio_key" };
  return authorizeAcnWorkerForProject(req, projectId, identity.agentId, opts);
}
