import { z } from "zod";
import { badRequest, notFoundJson } from "@/lib/auth";
import { requireOwnedJoinRequest } from "@/lib/columnOwner";
import { approveJoinRequest } from "@/lib/orgJoin";

type Ctx = { params: Promise<{ requestId: string }> };

const bodySchema = z.object({
  role: z.string().trim().min(1).max(64).optional(),
});

/** Column owner approves a join request for their own column's Org. */
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

  const result = await approveJoinRequest({
    requestId,
    expectedOrgId: access.request.acnOrgId,
    role: parsed.data.role,
  });
  if (result instanceof Response) return result;
  return Response.json({ status: "approved", ...result });
}
