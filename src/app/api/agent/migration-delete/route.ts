import { checkApiKey, unauthorized, badRequest, serverError } from "@/lib/auth";

export const runtime = "nodejs";

// 配套 migration-upload 的清理端点:迁移方(运营方)取到内容后调用,把上传到
// Blob 的迁移包删掉,缩短它公开可读的存活时间。迁移完成后应删除本文件
// (以及配套的 migration-upload)。
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  const body = await req.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== "string" || !url) return badRequest("`url` is required");

  try {
    const { del } = await import("@vercel/blob");
    await del(url);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[migration-delete] failed:", err);
    return serverError("Delete failed");
  }
}
