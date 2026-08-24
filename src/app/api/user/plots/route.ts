import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized, badRequest, forbidden, serverError, conflict } from "@/lib/auth";
import { parseBody, withRetry, withRouteErrors, mapError } from "@/lib/api";
import { ownerFields, resolveCreateOwner } from "@/lib/owner";
import { ensureUserProfile } from "@/lib/userHandle";
import { nextClaimIndex, spiralCoord } from "@/lib/plotSpiral";
import { bareAgentId, bearerFromRequest, userOwnsAgent } from "@/lib/myAgents";
import { uploadPlotCoverFile } from "@/lib/plotCover";

const optionalText = z.string().trim().max(2000).optional().nullable();

const createPlotSchema = z.object({
  ownerAgentId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  description: optionalText,
  coverUrl: optionalText.refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "coverUrl must be an http(s) URL",
  ),
});

type CreatePlotBody = z.infer<typeof createPlotSchema>;

async function parseCreatePlotBody(req: Request): Promise<CreatePlotBody | Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    try {
      return await parseBody(req, createPlotSchema);
    } catch (err) {
      return mapError(err);
    }
  }

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Invalid multipart form data");

  const ownerAgentId = String(form.get("ownerAgentId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const descriptionRaw = form.get("description");
  const description =
    descriptionRaw == null || descriptionRaw === ""
      ? null
      : String(descriptionRaw).trim();

  let coverUrl: string | null = null;
  const fileEntry = form.get("file");
  if (fileEntry && typeof fileEntry !== "string") {
    try {
      coverUrl = await uploadPlotCoverFile(fileEntry as File);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/exceeds|Unsupported file type/i.test(msg)) return badRequest(msg);
      if (/not configured|credentials|BLOB_READ_WRITE_TOKEN/i.test(msg)) {
        return Response.json({ error: "Storage not configured on server" }, { status: 503 });
      }
      console.error("[user/plots] cover upload failed:", err);
      return serverError("Upload failed");
    }
  }

  const parsed = createPlotSchema.safeParse({
    ownerAgentId,
    name,
    description,
    coverUrl,
  });
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request body");
  }
  return parsed.data;
}

/**
 * Claim the next spiral cell for the caller's agent (导游)
 * and open the origin 项目 owned by the same agent (起源主事).
 */
export const POST = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const token = bearerFromRequest(req);
  if (!token) return unauthorized();

  const body = await parseCreatePlotBody(req);
  if (body instanceof Response) return body;

  const ownerAgentId = bareAgentId(body.ownerAgentId);
  if (!ownerAgentId) return badRequest("ownerAgentId is required");

  const owned = await userOwnsAgent(token, ownerAgentId);
  if (owned === null) {
    return serverError("Could not verify agent ownership with AgentPlanet");
  }
  if (!owned) {
    return forbidden("You can only create a plot with an agent you own");
  }

  const owner = resolveCreateOwner({
    requested: { kind: "agent", agentId: ownerAgentId },
    actor: { kind: "user", userId: sub },
  });
  await ensureUserProfile(sub);

  try {
    const plot = await withRetry(() =>
      prisma.$transaction(async (tx) => {
        const latest = await tx.plot.findFirst({
          orderBy: { claimIndex: "desc" },
          select: { claimIndex: true },
        });
        const claimIndex = nextClaimIndex(latest?.claimIndex);
        const { x, y } = spiralCoord(claimIndex);
        const name = body.name;
        const description = body.description?.trim() || null;
        const coverUrl = body.coverUrl?.trim() || null;
        const project = await tx.project.create({
          data: {
            name,
            description,
            coverUrl,
            ...ownerFields(owner),
            visibility: "PRIVATE",
          },
        });
        return tx.plot.create({
          data: {
            claimIndex,
            x,
            y,
            ownerAgentId,
            name,
            description,
            coverUrl,
            originProjectId: project.id,
          },
          include: { originProject: { select: { shareToken: true } } },
        });
      }),
    );

    return Response.json(
      {
        id: plot.id,
        x: plot.x,
        y: plot.y,
        claimIndex: plot.claimIndex,
        ownerAgentId: plot.ownerAgentId,
        name: plot.name,
        shareToken: plot.originProject.shareToken,
        sharePath: `/p/${plot.originProject.shareToken}`,
      },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return conflict("plot_claim_race");
    }
    throw err;
  }
});
