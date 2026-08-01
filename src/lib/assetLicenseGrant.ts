import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { acceptCastingOrder, getCheckout } from "@/lib/agentplanet";
import { copyAuthorFor, copyNotice } from "@/lib/assetLicense";
import { PUBLISHED } from "@/lib/assetPublish";

/**
 * Granting usage rights to a published asset, free or paid.
 *
 * Shared by the immediate free grant and the post-payment confirmation, which
 * is what keeps a paid licence from being materialised differently — or twice.
 */

export type GrantResult =
  | { ok: true; license: Prisma.AssetLicenseGetPayload<object>; copied: boolean }
  | { ok: false; reason: "withdrawn" | "in_progress" };

/**
 * The copy must happen exactly once even though a double click, a retry, the
 * return page and the lazy reconciler can all arrive together. Whoever wins the
 * unique constraint (or flips a pending row) is the one that copies.
 *
 * Publish state is re-read inside the transaction: the owner can withdraw
 * between the caller's check and this write, and a grant for an asset that is
 * no longer published hands out something nobody backs.
 */
export async function grantAssetLicense(args: {
  asset: { id: string; name: string; description: string | null; type: string };
  projectId: string;
  projectVisibility: string;
  sub: string;
  points: number;
  orderId: string | null;
  /**
   * What the licensee gets, when it does not come from a pinned take.
   *
   * A project asset is licensable because it was published, and hands over the
   * take pinned at publish. A marketplace character answers to its own rules
   * (public, open for casting, priced) and has no pinned take — its caller
   * passes the artwork straight from the character, which is also the only
   * copy of it guaranteed to be current: mirroring artwork onto the backing
   * asset is best-effort, and a lagging mirror must not hand a buyer who just
   * paid an outdated picture.
   */
  artwork?: { imageUrl: string; audioUrl: string | null };
  /** Where the copy says it came from; defaults to the asset wording. */
  note?: string;
}): Promise<GrantResult> {
  const { asset, projectId, sub, points, orderId } = args;
  const uniqueWhere = { assetId_projectId: { assetId: asset.id, projectId } };
  const author = copyAuthorFor({
    projectVisibility: args.projectVisibility,
    licenseeSub: sub,
  });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let pinned = args.artwork ?? null;
        if (!pinned) {
          const live = await tx.asset.findFirst({
            where: { id: asset.id, publishState: PUBLISHED },
            select: {
              publishedVersion: { select: { imageUrl: true, audioUrl: true } },
            },
          });
          pinned = live?.publishedVersion ?? null;
        }
        if (!pinned) return { withdrawn: true as const };

        const flipped = await tx.assetLicense.updateMany({
          where: {
            assetId: asset.id,
            projectId,
            status: { not: "GRANTED" },
          },
          data: { status: "GRANTED", licenseeSub: sub, points, storeOrderId: orderId },
        });
        if (flipped.count === 0) {
          const existing = await tx.assetLicense.findUnique({ where: uniqueWhere });
          if (existing) return { license: existing, copied: false };
          await tx.assetLicense.create({
            data: {
              assetId: asset.id,
              projectId,
              licenseeSub: sub,
              points,
              status: "GRANTED",
              storeOrderId: orderId,
            },
          });
        }

        await tx.asset.create({
          data: {
            projectId,
            type: asset.type,
            name: asset.name,
            description: asset.description,
            authorUserId: author.authorUserId,
            authorAgentId: author.authorAgentId,
            authorKey: author.authorKey,
            versions: {
              create: {
                version: 1,
                imageUrl: pinned.imageUrl,
                audioUrl: pinned.audioUrl,
                notes: args.note ?? copyNotice(asset.name),
              },
            },
          },
        });

        return {
          license: await tx.assetLicense.findUniqueOrThrow({ where: uniqueWhere }),
          copied: true,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if ("withdrawn" in result) return { ok: false, reason: "withdrawn" };
    if (result.copied) emitProjectUpdate(projectId, "asset.created");
    return { ok: true, license: result.license, copied: result.copied };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // A concurrent request got there first. Only a granted row means the copy
      // actually happened; anything else is still in flight.
      const license = await prisma.assetLicense.findUnique({ where: uniqueWhere });
      if (license?.status === "GRANTED") {
        return { ok: true, license, copied: false };
      }
      return { ok: false, reason: "in_progress" };
    }
    throw err;
  }
}

/**
 * Lazy self-healing: a buyer may pay and never come back to confirm (tab
 * closed, redirect not followed). Anything of theirs stuck in PENDING_PAYMENT
 * gets settled the next time they touch Studio, so a paid licence never
 * depends on the buyer's browser staying open.
 */
export async function reconcilePendingAssetLicenses(sub: string): Promise<void> {
  const pending = await prisma.assetLicense.findMany({
    where: { licenseeSub: sub, status: "PENDING_PAYMENT", storeOrderId: { not: null } },
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          // A character's asset has no pinned take; the artwork comes off the
          // character itself, which is always current.
          character: { select: { imageUrl: true, audioUrl: true } },
        },
      },
      project: { select: { visibility: true } },
    },
  });
  if (pending.length === 0) return;

  for (const license of pending) {
    if (!license.storeOrderId) continue;
    try {
      const checkout = await getCheckout(license.storeOrderId);
      if (!checkout) continue; // Store unreachable; try again next time

      if (checkout.state === "fulfilling" || checkout.state === "completed") {
        // The payer must be this account. An unfilled buyer_id is not waved
        // through: that would settle on the Store's internals staying as they
        // are today.
        if (!checkout.buyer_id || checkout.buyer_id !== sub) continue;
        const granted = await grantAssetLicense({
          asset: license.asset,
          projectId: license.projectId,
          projectVisibility: license.project.visibility,
          sub,
          points: checkout.amount_credits,
          orderId: license.storeOrderId,
          artwork: license.asset.character
            ? {
                imageUrl: license.asset.character.imageUrl,
                audioUrl: license.asset.character.audioUrl,
              }
            : undefined,
        });
        if (granted.ok) await acceptCastingOrder(license.storeOrderId, sub);
      } else if (
        checkout.state === "cancelled" ||
        checkout.state === "expired" ||
        checkout.state === "refunded"
      ) {
        // Dead order: clear the placeholder so the buyer can start over.
        await prisma.assetLicense.delete({ where: { id: license.id } }).catch(() => {});
      }
      // pending: not paid yet, leave it
    } catch {
      // best effort: one stuck row must not break the caller's request
    }
  }
}
