import { uploadFile } from "@/lib/storage";
import { checkApiKey, badRequest, serverError } from "@/lib/auth";
import { authorizeProjectWorker, readAcnTaskIdHeader } from "@/lib/acnAuth";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_MIME =
  /^(image\/(png|jpeg|jpg|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp3|wav|x-wav|ogg|aac|mp4|x-m4a|webm))$/;

// 消毒文件名:仅保留基础名,过滤危险字符,限制长度
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  return cleaned || "upload";
}

// Agent 上传媒体文件(图片或视频),返回公网 URL
// - STUDIO_API_KEY: 全权限上传
// - ACN worker: 必须带 X-Acn-Task-Id + X-Project-Id(任务映射校验)
export async function POST(req: Request) {
  let projectIdForWorker: string | null = null;
  if (!checkApiKey(req)) {
    projectIdForWorker = req.headers.get("x-project-id")?.trim() || null;
    if (!projectIdForWorker) {
      return badRequest("ACN workers must send X-Project-Id and X-Acn-Task-Id for upload");
    }
    if (!readAcnTaskIdHeader(req)) {
      return badRequest("ACN workers must send X-Acn-Task-Id for upload");
    }
    const auth = await authorizeProjectWorker(req, projectIdForWorker);
    if (auth instanceof Response) return auth;
  }

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
    return badRequest(`Unsupported file type: ${fileMime}. Only images, videos and audio are allowed.`);
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
