import { badRequest, serverError, unauthorized } from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";
import { withRouteErrors } from "@/lib/api";
import { uploadPlotCoverFile } from "@/lib/plotCover";

export const runtime = "nodejs";

/** Upload a plot cover image before the plot exists. Prefer multipart create instead. */
export const POST = withRouteErrors(async (req: Request) => {
  if (!(await verifyUserToken(req))) return unauthorized();

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("multipart/form-data required");
  }

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Invalid multipart form data");

  const entry = form.get("file");
  if (!entry || typeof entry === "string") return badRequest("`file` field is required");
  const f = entry as File;

  try {
    const url = await uploadPlotCoverFile(f);
    return Response.json({ url }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/exceeds|Unsupported file type/i.test(msg)) return badRequest(msg);
    if (/not configured|credentials|BLOB_READ_WRITE_TOKEN/i.test(msg)) {
      return Response.json({ error: "Storage not configured on server" }, { status: 503 });
    }
    console.error("[user/plots/cover] failed:", err);
    return serverError("Upload failed");
  }
});
