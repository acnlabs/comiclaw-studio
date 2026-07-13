import { put } from "@vercel/blob";
import { checkApiKey, unauthorized, badRequest } from "@/lib/auth";

export const runtime = "nodejs";

// Agent 上传媒体文件(图片或视频)并获取公网 URL
// 用途:agent 沙箱无法直接访问对象存储时,通过 Studio 中转上传
// 请求格式:multipart/form-data,字段名 file(二进制)+ 可选 filename
export async function POST(req: Request) {
  if (!checkApiKey(req)) return unauthorized();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "File storage not configured. Set BLOB_READ_WRITE_TOKEN in Vercel Blob." },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";

  let file: Blob;
  let filename: string;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return badRequest("Invalid multipart form data");
    const entry = form.get("file");
    if (!entry || typeof entry === "string") return badRequest("`file` field is required");
    file = entry as File;
    filename = (entry as File).name || form.get("filename")?.toString() || "upload";
  } else {
    // 也支持直接 Content-Type: video/mp4 等的 raw body 上传
    const body = await req.arrayBuffer().catch(() => null);
    if (!body || body.byteLength === 0) return badRequest("Empty body");
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    filename = req.headers.get("x-filename") || `upload.${ext}`;
    file = new Blob([body], { type: contentType });
  }

  const blob = await put(`studio/${Date.now()}-${filename}`, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  return Response.json({ url: blob.url }, { status: 201 });
}
