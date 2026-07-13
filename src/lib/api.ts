import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { checkApiKey, unauthorized, badRequest, notFoundJson, conflict, serverError } from "@/lib/auth";

// 统一封装 Agent API 路由:鉴权 + Prisma 错误映射 + Zod 校验错误处理
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
