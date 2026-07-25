import { checkApiKey, unauthorized, badRequest, serverError } from "@/lib/auth";

// Ops: comiclaw-studio(creator) 取消 ACN 任务(清理探针/竞态冒烟残留)。
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  const body = (await req.json().catch(() => null)) as {
    taskId?: unknown;
    reason?: unknown;
  } | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
  const reason =
    typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "ops cleanup";
  if (!taskId) return badRequest("taskId is required");

  const acnBase = (process.env.ACN_API_URL ?? "https://api.acnlabs.dev").trim().replace(/\/+$/, "");
  const chatKey = (process.env.ACN_CHAT_API_KEY ?? "").trim();
  if (!chatKey) return serverError("ACN_CHAT_API_KEY not configured");

  try {
    const res = await fetch(`${acnBase}/api/v1/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chatKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ reason }),
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      return Response.json(
        { error: "ACN cancel failed", status: res.status, detail: data },
        { status: 502 }
      );
    }
    return Response.json({ ok: true, taskId, result: data });
  } catch (err) {
    console.error("[admin/acn/tasks/cancel]", err);
    return serverError(err instanceof Error ? err.message : "cancel failed");
  }
}
