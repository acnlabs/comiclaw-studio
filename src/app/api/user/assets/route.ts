import { prisma } from "@/lib/db";
import { verifyUserToken } from "@/lib/userAuth";
import { unauthorized } from "@/lib/auth";
import { governedOrgIds } from "@/lib/orgGovernance";
import { canPublishAsAuthor, PUBLISHED } from "@/lib/assetPublish";
import { controlsAsset } from "@/lib/assetTransfer";

/**
 * Every asset this person can act on, wherever it lives.
 *
 * The workspace shows a project's assets; this is the other axis — one place
 * to see and manage what you hold, whether it came out of a project or was
 * made on its own. Assets held by an Org you govern are included, because
 * pricing and transferring them is your call.
 */
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const orgIds = await governedOrgIds(sub);

  const assets = await prisma.asset.findMany({
    where: {
      // A character's backing asset is the same thing as the character listed
      // just above it on this page, and its listing is managed there. Showing
      // it twice would offer two ways to register one subject.
      character: { is: null },
      OR: [
        { authorUserId: sub },
        { ownerType: "user", ownerId: sub },
        ...(orgIds.length ? [{ ownerType: "org", ownerId: { in: orgIds } }] : []),
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      type: true,
      name: true,
      description: true,
      publishState: true,
      licensePoints: true,
      ownerType: true,
      ownerId: true,
      authorUserId: true,
      authorAgentId: true,
      authorKey: true,
      publishedVersion: { select: { imageUrl: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, imageUrl: true },
      },
      project: { select: { name: true, shareToken: true, visibility: true } },
    },
  });

  const licensed = await prisma.assetLicense.groupBy({
    by: ["assetId"],
    where: { assetId: { in: assets.map((a) => a.id) }, status: "GRANTED" },
    _count: { assetId: true },
  });
  const licensedBy = new Map(licensed.map((l) => [l.assetId, l._count.assetId]));

  // The rules live server-side; the client should not re-derive who may act,
  // it should just avoid rendering a button that would come back 403.
  const rights = (a: (typeof assets)[number]) => ({
    canPublish: canPublishAsAuthor({
      authorUserId: a.authorUserId,
      authorAgentId: a.authorAgentId,
      authorKey: a.authorKey,
      projectVisibility: a.project?.visibility ?? null,
      publisherSub: sub,
    }),
    canManage:
      a.ownerType && a.ownerId
        ? controlsAsset({
            owner: { type: a.ownerType as "user" | "agent" | "org", id: a.ownerId },
            actor: { type: "user", id: sub },
            governs: orgIds,
          })
        : false,
  });

  return Response.json({
    assets: assets.map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      description: a.description,
      publishState: a.publishState,
      licensePoints: a.licensePoints,
      ownerType: a.ownerType,
      ownerId: a.ownerId,
      authorUserId: a.authorUserId,
      authorAgentId: a.authorAgentId,
      authorKey: a.authorKey,
      // The pinned take is what a licensee gets; before publishing, the newest.
      imageUrl:
        (a.publishState === PUBLISHED ? a.publishedVersion?.imageUrl : null) ??
        a.versions[0]?.imageUrl ??
        null,
      latestVersionId: a.versions[0]?.id ?? null,
      project: a.project
        ? { name: a.project.name, shareToken: a.project.shareToken }
        : null,
      licensedCount: licensedBy.get(a.id) ?? 0,
      ...rights(a),
    })),
  });
}
