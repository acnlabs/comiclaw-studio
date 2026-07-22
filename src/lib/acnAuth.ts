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

/** 该 ACN agent 是否被授权操作此任务(invitee / assignee / metadata 指定工人) */
export function agentAuthorizedOnAcnTask(agentId: string, task: AcnTask): boolean {
  if (task.assignee_id && task.assignee_id === agentId) return true;
  const invited = task.invited_agent_ids ?? [];
  if (invited.includes(agentId)) return true;
  const meta = task.metadata ?? {};
  const worker = meta.worker_agent_id;
  if (typeof worker === "string" && worker === agentId) return true;
  return false;
}

/**
 * 解析生产调用方:
 * - STUDIO_API_KEY → 官方全权限(无需任务绑定)
 * - 否则按 ACN Bearer 解析 agent,并校验任务↔项目绑定
 */
export async function authorizeProjectWorker(
  req: Request,
  projectId: string,
  opts?: { acnTaskId?: string | null }
): Promise<ProductionAuth | Response> {
  if (checkApiKey(req)) {
    return { kind: "studio_key" };
  }

  const bearer = extractBearer(req);
  if (!bearer) return unauthorized();

  const agentId = await resolveAcnAgentId(bearer);
  if (!agentId) return unauthorized();

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

  const status = (task.status || "").toLowerCase();
  if (["cancelled", "canceled", "rejected", "expired"].includes(status)) {
    return forbidden(`ACN task status '${task.status}' does not allow Studio writes`);
  }

  if (!agentAuthorizedOnAcnTask(agentId, task)) {
    return forbidden("ACN agent is not invited/assigned to this task");
  }

  return { kind: "acn_worker", agentId, acnTaskId };
}

/** 仅认证(定价/ping):Studio key 或任意有效 ACN agent,不做任务绑定 */
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
