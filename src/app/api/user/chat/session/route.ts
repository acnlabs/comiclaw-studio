import { z } from "zod";
import { getLocale } from "@/lib/locale";
import { unauthorized, badRequest } from "@/lib/auth";
import { parseBody, withRouteErrors, mapError } from "@/lib/api";
import { verifyUserToken } from "@/lib/userAuth";
import { bareAgentId, bearerFromRequest } from "@/lib/myAgents";
import { chatGatewayConfigured, createEmbedSession } from "@/lib/chatGateway";

const sessionSchema = z.object({
  agentId: z.string().trim().min(1).max(200),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentOrigin: z.string().trim().url().optional(),
  theme: z.enum(["dark", "light", "auto"]).optional(),
});

function parentOriginFrom(req: Request, bodyOrigin?: string): string | null {
  if (bodyOrigin) {
    try {
      return new URL(bodyOrigin).origin;
    } catch {
      return null;
    }
  }
  const header = req.headers.get("origin")?.trim();
  if (header) {
    try {
      return new URL(header).origin;
    } catch {
      return null;
    }
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return null;
  }
}

/** Human JWT → Interfaze embed session. See docs/interfaze-embed.md */
export const POST = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const bearer = bearerFromRequest(req);
  if (!bearer) return unauthorized();

  if (!chatGatewayConfigured()) {
    return Response.json(
      { error: "Chat Gateway is not configured", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let body: z.infer<typeof sessionSchema>;
  try {
    body = await parseBody(req, sessionSchema);
  } catch (err) {
    return mapError(err);
  }

  const agentId = bareAgentId(body.agentId);
  if (!agentId) return badRequest("agentId is required");

  const parentOrigin = parentOriginFrom(req, body.parentOrigin);
  if (!parentOrigin) return badRequest("parent_origin is required");

  const locale = await getLocale();
  const result = await createEmbedSession(bearer, {
    agentId,
    parentOrigin,
    metadata: body.metadata,
    locale,
    theme: body.theme ?? "dark",
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code ?? "UPSTREAM_ERROR" },
      { status: result.status },
    );
  }

  return Response.json({
    embedUrl: result.session.embedUrl,
    chatId: result.session.chatId,
    agentId: result.session.agentId,
    expiresAt: result.session.expiresAt,
    expiresIn: result.session.expiresIn,
  });
});
