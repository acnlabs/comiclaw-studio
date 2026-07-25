import { checkApiKey, unauthorized, badRequest, serverError } from "@/lib/auth";

// Ops: comiclaw-studio(subnet owner) 邀请 agent 加入 private subnet。
// 若对方已有 pending join request,ACN 会 auto-resolve 为批准入网。
// 鉴权同 migrate:STUDIO_API_KEY(勿暴露给开放工人)。
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  const body = (await req.json().catch(() => null)) as {
    slug?: unknown;
    agentId?: unknown;
  } | null;
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
  if (!slug || !agentId) {
    return badRequest("slug and agentId are required");
  }

  const acnBase = (process.env.ACN_API_URL ?? "https://api.acnlabs.dev").trim().replace(/\/+$/, "");
  const chatKey = (process.env.ACN_CHAT_API_KEY ?? "").trim();
  if (!chatKey) {
    return serverError("ACN_CHAT_API_KEY not configured");
  }

  try {
    const res = await fetch(
      `${acnBase}/api/v1/subnets/${encodeURIComponent(slug)}/invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chatKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ agent_id: agentId }),
        cache: "no-store",
      }
    );
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      return Response.json(
        { error: "ACN invite failed", status: res.status, detail: data },
        { status: 502 }
      );
    }
    return Response.json({ ok: true, slug, agentId, result: data });
  } catch (err) {
    console.error("[admin/acn/subnet-invite]", err);
    return serverError(err instanceof Error ? err.message : "invite failed");
  }
}
