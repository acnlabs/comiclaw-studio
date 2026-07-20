import { randomUUID } from "crypto";
import { checkApiKey, unauthorized, badRequest, serverError } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

export const runtime = "nodejs";

// 临时端点,仅供老实例(comiclaw on 秒搭)把自己的能力资产(SOUL/IDENTITY/workspace
// 文档/memory 等文本,打包成 tar.gz)导出给运营方,用于迁移到新实例。
// 鉴权复用现有 STUDIO_API_KEY(老实例已持有,用于与本项目同步生产进度的同一把 key),
// 不引入新凭证。迁移完成后应删除本文件(以及配套的 migration-delete)。
//
// 与 /api/agent/upload 的区别:那个端点是媒体上传的常规业务路径,限制 mime 为
// image/video/audio;这里不限制类型,只限制大小,专供本次一次性迁移使用。
const MAX_BYTES = 50 * 1024 * 1024; // 50MB,迁移包(文本为主)不该超过这个量级

export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  const clen = Number(req.headers.get("content-length") ?? "0");
  if (clen > MAX_BYTES) return badRequest(`File exceeds ${MAX_BYTES} bytes limit`);

  const body = await req.arrayBuffer().catch(() => null);
  if (!body || body.byteLength === 0) return badRequest("Empty body");
  if (body.byteLength > MAX_BYTES) return badRequest(`File exceeds ${MAX_BYTES} bytes limit`);

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  // 存储桶默认公开可读,用随机文件名代替可预测命名,避免结果 URL 被猜到
  const filename = `migration-${randomUUID()}.bin`;

  try {
    const result = await uploadFile(new Blob([body], { type: contentType }), filename, contentType);
    return Response.json({ url: result.url }, { status: 201 });
  } catch (err) {
    console.error("[migration-upload] failed:", err);
    return serverError("Upload failed");
  }
}
