import { embedSessionContext } from "@/lib/embedContext";
import { bareAgentId } from "@/lib/myAgents";

/** AgentPlanet Chat Gateway (same origin as /api/chat/my-agents). */
export function chatApiOrigin(): string {
  return (
    process.env.AGENTPLANET_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AGENTPLANET_API_URL?.trim() ||
    "https://api.agentplanet.org"
  ).replace(/\/+$/, "");
}

export function comiclawAgentId(): string {
  return bareAgentId(
    process.env.NEXT_PUBLIC_COMICLAW_AGENT_ID?.trim() ||
      process.env.ACN_CHAT_AGENT_ID?.trim() ||
      "",
  );
}

export function chatGatewayConfigured(): boolean {
  return Boolean(
    process.env.AGENTPLANET_API_URL?.trim() ||
      process.env.NEXT_PUBLIC_AGENTPLANET_API_URL?.trim(),
  );
}

export type EmbedSessionInput = {
  agentId: string;
  parentOrigin: string;
  context?: string;
  metadata?: Record<string, unknown>;
  locale?: string;
  theme?: "dark" | "light" | "auto";
};

export type EmbedSession = {
  embedUrl: string;
  chatId: string;
  agentId: string;
  expiresAt: string | null;
  expiresIn: number | null;
};

export type EmbedSessionResult =
  | { ok: true; session: EmbedSession }
  | { ok: false; status: number; code?: string; error?: string };

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/** FastAPI structured errors use `{ detail: { code, message } }`. */
function gatewayFailure(
  data: Record<string, unknown> | null,
  fallback: string,
): { code?: string; error: string } {
  const detail = data?.detail;
  const nested =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : null;
  const code = pickString(data ?? {}, "code") || pickString(nested ?? {}, "code") || undefined;
  const error =
    pickString(data ?? {}, "error", "message") ||
    pickString(nested ?? {}, "message", "error") ||
    (typeof detail === "string" && detail.trim() ? detail.trim() : "") ||
    fallback;
  return { code, error };
}

/**
 * Human Auth0 JWT → short-lived Interfaze embed session.
 * @see agentplanet docs/product/interfaze-embed-v0.md
 */
export async function createEmbedSession(
  bearer: string,
  input: EmbedSessionInput,
): Promise<EmbedSessionResult> {
  const token = bearer.trim();
  const agentId = bareAgentId(input.agentId);
  const parentOrigin = input.parentOrigin.trim();
  if (!token || !agentId || !parentOrigin) {
    return { ok: false, status: 400, code: "bad_request", error: "Missing fields" };
  }

  try {
    const res = await fetch(`${chatApiOrigin()}/api/chat/embed/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        parent_origin: parentOrigin,
        context: embedSessionContext(input.metadata, input.context),
        metadata: {
          source: "comiclaw-studio",
          ...input.metadata,
        },
        locale: input.locale,
        theme: input.theme ?? "dark",
      }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data) {
      const failure = gatewayFailure(data, "embed session failed");
      return {
        ok: false,
        status: res.status >= 400 ? res.status : 502,
        code: failure.code,
        error: failure.error,
      };
    }
    const embedUrl = pickString(data, "embed_url", "embedUrl");
    const chatId = pickString(data, "chat_id", "chatId");
    if (!embedUrl || !chatId) {
      return {
        ok: false,
        status: 502,
        code: "UPSTREAM_ERROR",
        error: "Gateway response missing embed_url or chat_id",
      };
    }
    return {
      ok: true,
      session: {
        embedUrl,
        chatId,
        agentId: pickString(data, "agent_id", "agentId") || agentId,
        expiresAt: pickString(data, "expires_at", "expiresAt") || null,
        expiresIn: pickNumber(data, "expires_in", "expiresIn"),
      },
    };
  } catch {
    return { ok: false, status: 502, code: "UPSTREAM_ERROR", error: "Gateway unreachable" };
  }
}
