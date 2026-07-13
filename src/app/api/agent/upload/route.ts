import { uploadFile } from "@/lib/storage";
import { checkApiKey, unauthorized, badRequest } from "@/lib/auth";

export const runtime = "nodejs";

// Agent 上传媒体文件(图片或视频),返回公网 URL
// 支持 multipart/form-data(字段名 file)或 raw body(附带正确 Content-Type)
// 存储后端由环境变量 STORAGE_PROVIDER 控制:blob(默认) | oss | cos
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  const contentType = req.headers.get("content-type") ?? "";

  let fileBody: Blob;
  let filename: string;
  let fileMime: string;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return badRequest("Invalid multipart form data");
    const entry = form.get("file");
    if (!entry || typeof entry === "string") return badRequest("`file` field is required");
    fileBody = entry as File;
    filename = (entry as File).name || form.get("filename")?.toString() || "upload";
    fileMime = (entry as File).type || "application/octet-stream";
  } else {
    const body = await req.arrayBuffer().catch(() => null);
    if (!body || body.byteLength === 0) return badRequest("Empty body");
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    filename = req.headers.get("x-filename") || `upload.${ext}`;
    fileMime = contentType || "application/octet-stream";
    fileBody = new Blob([body], { type: fileMime });
  }

  try {
    const result = await uploadFile(fileBody, filename, fileMime);
    return Response.json({ url: result.url }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not configured")) {
      return Response.json(
        { error: `Storage not configured: ${msg}. Set STORAGE_PROVIDER and credentials in environment variables.` },
        { status: 503 }
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
