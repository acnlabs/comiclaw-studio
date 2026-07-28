import { z } from "zod";
import { badRequest, notFoundJson } from "@/lib/auth";
import { requireOwnedJoinRequest } from "@/lib/columnOwner";
import { rejectJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ requestId: string }> };

const bodySchema = z.object({
  decisionNote: z.string().trim().max(500).optional().nullable(),
});

/** Column owner rejects a join request for their own column's Org. */
export async function POST(req: Request, ctx: Ctx) {
  const { requestId: rawId } = await ctx.params;
  const requestId = rawId?.trim();
  if (!requestId) return notFoundJson();

  const access = await requireOwnedJoinRequest(req, requestId);
  if (access instanceof Response) return access;

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ")
    );
  }

  const result = await rejectJoinRequest({
    requestId,
    expectedOrgId: access.request.acnOrgId,
    decisionNote: parsed.data.decisionNote,
  });
  if (result instanceof Response) return result;
  return Response.json({ status: "rejected", ...result });
}
