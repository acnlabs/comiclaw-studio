import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { badRequest, extractBearer, serverError } from "@/lib/auth";
import {
  authenticateStudioOrAcnAgent,
  authorizeAcnForProject,
  readAcnTaskIdHeader,
} from "@/lib/acnAuth";
import { assertAgentCanContribute } from "@/lib/orgBinding";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const ALLOWED_MIME =
  /^(image\/(png|jpeg|jpg|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp3|wav|x-wav|ogg|aac|mp4|x-m4a|webm))$/;

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  return cleaned || "upload";
}

// Agent 上传媒体文件(图片或视频),返回公网 URL
// - STUDIO_API_KEY: 全权限上传
// - ACN worker: X-Acn-Task-Id + X-Project-Id
// - ACN contributor: PUBLIC 项目可仅 X-Project-Id(无 Task)
export async function POST(req: Request) {
  const identity = await authenticateStudioOrAcnAgent(req);
  if (identity instanceof Response) return identity;

  if (identity.kind === "acn_agent") {
    const projectId = req.headers.get("x-project-id")?.trim() || null;
    if (!projectId) {
      return badRequest(
        "ACN agents must send X-Project-Id (and X-Acn-Task-Id for production projects)"
      );
    }
    const auth = await authorizeAcnForProject(req, projectId, identity.agentId, {
      access: "write",
      allowPublicContribute: true,
      acnTaskId: readAcnTaskIdHeader(req),
    });
    if (auth instanceof Response) return auth;

    if (auth.kind === "acn_contributor") {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { visibility: true },
      });
      if (!project) return badRequest("Project not found");
      const gated = await assertAgentCanContribute({
        projectId,
        projectVisibility: project.visibility,
        agentId: identity.agentId,
        bearer: extractBearer(req) ?? undefined,
      });
      if (gated) return gated;
    }
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
    return badRequest(
      `Unsupported file type: ${fileMime}. Only images, videos and audio are allowed.`
    );
  }

  try {
    const result = await uploadFile(fileBody, filename, fileMime);
    return Response.json({ url: result.url }, { status: 201 });
  } catch (err) {
    console.error("[upload]", err);
    return serverError("Upload failed");
  }
}
