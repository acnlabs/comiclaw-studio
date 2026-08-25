import { extractBearerToken } from "@/lib/userAuth";

export type MyAgent = { id: string; name: string };

function chatApiOrigin(): string {
  return (
    process.env.AGENTPLANET_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AGENTPLANET_API_URL?.trim() ||
    "https://api.agentplanet.org"
  ).replace(/\/+$/, "");
}

export function bareAgentId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("acn:") ? trimmed.slice(4) : trimmed;
}

/** Disambiguate agents that share a display name. */
export function agentDisplayLabel(name: string, id: string): string {
  const tail = id.length > 8 ? id.slice(-8) : id;
  return `${name} · ${tail}`;
}

/** Chat Gateway: GET /api/chat/my-agents. Auth0 JWT of the human owner. */
export async function fetchMyAgents(bearer: string): Promise<MyAgent[] | null> {
  const token = bearer.trim();
  if (!token) return null;
  try {
    const res = await fetch(`${chatApiOrigin()}/api/chat/my-agents?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { agents?: unknown };
    const rows = Array.isArray(data.agents) ? data.agents : [];
    return rows
      .map((raw) => {
        const row = raw as { agent_id?: unknown; id?: unknown; name?: unknown };
        const id = bareAgentId(String(row.agent_id ?? row.id ?? ""));
        if (!id) return null;
        const name = String(row.name ?? "").trim() || id;
        return { id, name };
      })
      .filter((a): a is MyAgent => a != null);
  } catch {
    return null;
  }
}

/** true = owned, false = not owner / missing, null = upstream failed. */
export async function userOwnsAgent(
  bearer: string,
  agentId: string,
): Promise<boolean | null> {
  const token = bearer.trim();
  const id = bareAgentId(agentId);
  if (!token || !id) return false;
  try {
    const res = await fetch(
      `${chatApiOrigin()}/api/chat/my-agents/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (res.ok) return true;
    if (res.status === 403 || res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

export function bearerFromRequest(req: Request): string | null {
  return extractBearerToken(req);
}
