import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { checkApiKey, unauthorized, badRequest, notFoundJson, conflict, serverError } from "@/lib/auth";
import {
  authorizeProjectWorker,
  authenticateStudioOrAcnAgent,
  type ProductionAuth,
} from "@/lib/acnAuth";

// 统一封装 Agent API 路由:鉴权 + Prisma 错误映射 + Zod 校验错误处理
// 仅 STUDIO_API_KEY(官方编排 / 全权限运维)
export function withAgentAuth<Ctx>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    if (!checkApiKey(req)) return unauthorized();
    try {
      return await handler(req, ctx);
    } catch (err) {
      return mapError(err);
    }
  };
}

/**
 * 生产工人路由:STUDIO_API_KEY 或「ACN agent + 任务绑定」。
 * projectId 默认取 ctx.params.id;也可自定义(嵌套资源先查所属项目)。
 */
export function withProjectWorkerAuth<Ctx>(
  handler: (req: Request, ctx: Ctx, auth: ProductionAuth) => Promise<Response>,
  options?: {
    getProjectId?: (req: Request, ctx: Ctx) => Promise<string | null>;
    getAcnTaskId?: (req: Request, ctx: Ctx) => Promise<string | null | undefined>;
  }
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const projectId = options?.getProjectId
      ? await options.getProjectId(req, ctx)
      : await defaultProjectIdFromParams(ctx);
    if (!projectId) return notFoundJson();

    const acnTaskId = options?.getAcnTaskId
      ? await options.getAcnTaskId(req, ctx)
      : undefined;
    const auth = await authorizeProjectWorker(req, projectId, { acnTaskId });
    if (auth instanceof Response) return auth;

    try {
      return await handler(req, ctx, auth);
    } catch (err) {
      return mapError(err);
    }
  };
}

/** 定价等:Studio key 或任意有效 ACN agent(无项目绑定) */
export function withStudioOrAcnAgentAuth<Ctx>(
  handler: (
    req: Request,
    ctx: Ctx,
    auth: { kind: "studio_key" } | { kind: "acn_agent"; agentId: string }
  ) => Promise<Response>
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const auth = await authenticateStudioOrAcnAgent(req);
    if (auth instanceof Response) return auth;
    try {
      return await handler(req, ctx, auth);
    } catch (err) {
      return mapError(err);
    }
  };
}

async function defaultProjectIdFromParams(ctx: unknown): Promise<string | null> {
  const params = (ctx as { params?: Promise<{ id?: string }> })?.params;
  if (!params) return null;
  const { id } = await params;
  return id?.trim() || null;
}

function mapError(err: unknown): Response {
  if (err instanceof ZodError) {
    const msg = err.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return badRequest(msg);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return conflict("Unique constraint violation");
      case "P2003":
        return badRequest("Referenced record does not exist");
      case "P2025":
        return notFoundJson("Record not found");
      default:
        return badRequest(`Database error (${err.code})`);
    }
  }
  console.error("[api] unhandled error:", err);
  return serverError();
}

// 带重试的操作:并发下版本号唯一约束冲突(P2002)时自动重试
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        i < attempts - 1
      ) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// 解析并校验 JSON body
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ZodError([
      { code: "custom", message: "Invalid JSON body", path: [] },
    ]);
  }
  return schema.parse(raw);
}
