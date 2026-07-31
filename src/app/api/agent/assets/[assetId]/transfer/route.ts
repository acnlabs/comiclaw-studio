import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, extractBearer, notFoundJson, serverError } from "@/lib/auth";
import { mapError, parseBody, withProjectWorkerAuth } from "@/lib/api";
import { productionAgentId, type ProductionAuth } from "@/lib/acnAuth";
import { isAgentOrgMember } from "@/lib/acnOrg";
import { checkTransfer } from "@/lib/assetTransfer";
import { refuseTransfer, runTransfer } from "@/lib/assetTransferFlow";

/**
 * An agent hands an asset it owns to an Org it belongs to.
 *
 * There is no way back through this route: membership says the agent is part
 * of the Org, not that it speaks for it, and ACN's role vocabulary is not
 * something to guess at when the answer decides who keeps the asset. Taking an
 * asset out of an Org goes through the human who governs it.
 */

type Ctx = { params: Promise<{ assetId: string }> };

const transferSchema = z.object({
  orgId: z.string().trim().min(1).max(128),
});

const getProjectId = async (_req: Request, ctx: Ctx) => {
  const { assetId } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { projectId: true },
  });
  return asset?.projectId ?? null;
};

export const POST = withProjectWorkerAuth(
  async (req: Request, ctx: Ctx, auth: ProductionAuth) => {
    const agentId = productionAgentId(auth);
    if (!agentId) {
      return badRequest("An agent identity is required to transfer an asset");
    }

    let body: z.infer<typeof transferSchema>;
    try {
      body = await parseBody(req, transferSchema);
    } catch (err) {
      return mapError(err);
    }

    const { assetId } = await ctx.params;
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        type: true,
        publishState: true,
        ownerType: true,
        ownerId: true,
      },
    });
    if (!asset) return notFoundJson("Asset not found");

    let member: boolean;
    try {
      member = await isAgentOrgMember(body.orgId, agentId, extractBearer(req) ?? undefined);
    } catch (err) {
      console.error("[asset/transfer] membership check failed", err);
      return serverError("Failed to verify ACN Org membership");
    }

    const move = checkTransfer({
      asset,
      actor: { type: "agent", id: agentId },
      entitlement: { putInto: member ? [body.orgId] : [], takeFrom: [] },
      target: { kind: "org", orgId: body.orgId },
    });
    if (!move.ok) return refuseTransfer(move.reason);

    return runTransfer({ asset, move });
  },
  { getProjectId, allowPublicContribute: true }
);
