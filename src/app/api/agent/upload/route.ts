import { uploadFile } from "@/lib/storage";
import { checkApiKey, unauthorized, badRequest, serverError } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_MIME = /^(image\/(png|jpeg|jpg|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime))$/;

// 消毒文件名:仅保留基础名,过滤危险字符,限制长度
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-]/g, "_").slice(0, 100);
  return cleaned || "upload";
}

// Agent 上传媒体文件(图片或视频),返回公网 URL
// 存储后端由环境变量 STORAGE_PROVIDER 控制:blob(默认) | oss | cos
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  const contentType = req.headers.get("content-type") ?? "";

  let fileBody: Blob;
  let filename: string;
  let fileMime: string;
  let size: number;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return badRequest("Invalid multipart form data");
    const entry = form.get("file");
    if (!entry || typeof entry === "string") return badRequest("`file` field is required");
    const f = entry as File;
    fileBody = f;
    filename = sanitizeFilename(f.name || form.get("filename")?.toString() || "upload");
    fileMime = f.type || "application/octet-stream";
    size = f.size;
  } else {
    const clen = Number(req.headers.get("content-length") ?? "0");
    if (clen > MAX_BYTES) return badRequest(`File exceeds ${MAX_BYTES} bytes limit`);
    const body = await req.arrayBuffer().catch(() => null);
    if (!body || body.byteLength === 0) return badRequest("Empty body");
    filename = sanitizeFilename(req.headers.get("x-filename") || "upload");
    fileMime = contentType || "application/octet-stream";
    fileBody = new Blob([body], { type: fileMime });
    size = body.byteLength;
  }

  if (size > MAX_BYTES) {
    return badRequest(`File exceeds ${MAX_BYTES} bytes limit`);
  }
  if (!ALLOWED_MIME.test(fileMime)) {
    return badRequest(`Unsupported file type: ${fileMime}. Only images and videos are allowed.`);
  }

  try {
    const result = await uploadFile(fileBody, filename, fileMime);
    return Response.json({ url: result.url }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not configured|credentials|BLOB_READ_WRITE_TOKEN/i.test(msg)) {
      return Response.json(
        { error: "Storage not configured on server" },
        { status: 503 }
      );
    }
    console.error("[upload] failed:", err);
    return serverError("Upload failed");
  }
}
