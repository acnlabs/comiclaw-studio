import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import {
  badRequest,
  serverError,
  unauthorized,
  notFoundJson,
} from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";
import { assertCanUserContribute } from "@/lib/projectAccess";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_MIME =
  /^(image\/(png|jpeg|jpg|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp3|wav|x-wav|ogg|aac|mp4|x-m4a|webm))$/;

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  return cleaned || "upload";
}

// 登录用户向可投稿项目上传媒体(需 shareToken)
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("multipart/form-data required");
  }

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Invalid multipart form data");

  const shareToken = form.get("shareToken")?.toString()?.trim() || "";
  if (!shareToken) return badRequest("`shareToken` is required");

  const project = await prisma.project.findUnique({
    where: { shareToken },
    select: {
      id: true,
      visibility: true,
      isPrivate: true,
      ownerUserId: true,
    },
  });
  if (!project) return notFoundJson();

  const denied = assertCanUserContribute(project, sub);
  if (denied) return denied;

  const entry = form.get("file");
  if (!entry || typeof entry === "string") return badRequest("`file` field is required");
  const f = entry as File;
  const filename = sanitizeFilename(
    f.name || form.get("filename")?.toString() || "upload"
  );
  const fileMime = f.type || "application/octet-stream";
  if (f.size > MAX_BYTES) {
    return badRequest(`File exceeds ${MAX_BYTES} bytes limit`);
  }
  if (!ALLOWED_MIME.test(fileMime)) {
    return badRequest(
      `Unsupported file type: ${fileMime}. Only images, videos and audio are allowed.`
    );
  }

  try {
    const result = await uploadFile(f, filename, fileMime);
    return Response.json({ url: result.url, projectId: project.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not configured|credentials|BLOB_READ_WRITE_TOKEN/i.test(msg)) {
      return Response.json(
        { error: "Storage not configured on server" },
        { status: 503 }
      );
    }
    console.error("[user/upload] failed:", err);
    return serverError("Upload failed");
  }
}
