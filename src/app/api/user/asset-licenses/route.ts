import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitProjectUpdate } from "@/lib/events";
import { verifyUserToken } from "@/lib/userAuth";
import {
  badRequest,
  conflict,
  forbidden,
  notFoundJson,
  unauthorized,
} from "@/lib/auth";
import { mapError, parseBody } from "@/lib/api";
import {
  checkLicensable,
  copyAuthorFor,
  copyNotice,
} from "@/lib/assetLicense";
import { PUBLISHED } from "@/lib/assetPublish";

const licenseSchema = z.object({
  assetId: z.string().trim().min(1).max(64),
  projectId: z.string().trim().min(1).max(64),
});

const REFUSALS: Record<string, string> = {
  not_published: "This asset is not published",
  no_pinned_version: "This asset has no published version yet",
  not_your_project: "You can only license into your own project",
  already_licensed: "Already licensed into this project",
};

/**
 * License a published asset into one of your projects.
 *
 * Free only for now. The copy is a fresh project asset, not a second
 * registration: the licensee gets something their pipeline can iterate on while
 * ownership of the original stays with whoever published it.
 */
export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  let body: z.infer<typeof licenseSchema>;
  try {
    body = await parseBody(req, licenseSchema);
  } catch (err) {
    return mapError(err);
  }

  const [asset, project] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: body.assetId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        publishState: true,
        publishedVersionId: true,
      },
    }),
    prisma.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, ownerUserId: true, visibility: true },
    }),
  ]);
  if (!asset) return notFoundJson("Asset not found");
  if (!project) return notFoundJson("Project not found");

  const existing = await prisma.assetLicense.findUnique({
    where: {
      assetId_projectId: { assetId: asset.id, projectId: project.id },
    },
  });
  if (existing?.status === "GRANTED") {
    return Response.json({ license: existing, alreadyLicensed: true });
  }

  const check = checkLicensable({
    publishState: asset.publishState,
    publishedVersionId: asset.publishedVersionId,
    projectOwnerUserId: project.ownerUserId,
    requesterSub: sub,
    existingStatus: existing?.status ?? null,
  });
  if (!check.ok) {
    const message = REFUSALS[check.reason] ?? "Cannot license this asset";
    if (check.reason === "not_your_project") return forbidden(message);
    if (check.reason === "already_licensed") return conflict(message);
    return badRequest(message);
  }

  const author = copyAuthorFor({
    projectVisibility: project.visibility,
    licenseeSub: sub,
  });

  // The copy must happen exactly once even though a double click, a retry and a
  // second tab can all arrive together. Whoever wins the unique constraint (or
  // flips a stale pending row) is the one that copies.
  //
  // The eligibility read above is only a fast rejection: the owner can withdraw
  // between it and the write, so the state is re-read inside a serializable
  // transaction. Without that, licensing races a withdrawal and hands out a
  // grant for an asset that is no longer published.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const live = await tx.asset.findFirst({
        where: { id: asset.id, publishState: PUBLISHED },
        select: {
          publishedVersion: { select: { imageUrl: true, audioUrl: true } },
        },
      });
      const pinned = live?.publishedVersion;
      if (!pinned) return { withdrawn: true as const };

      if (existing) {
        const flipped = await tx.assetLicense.updateMany({
          where: { id: existing.id, status: { not: "GRANTED" } },
          data: { status: "GRANTED", licenseeSub: sub, points: 0 },
        });
        if (flipped.count === 0) {
          return {
            license: await tx.assetLicense.findUniqueOrThrow({
              where: { id: existing.id },
            }),
            copied: false,
          };
        }
      } else {
        await tx.assetLicense.create({
          data: {
            assetId: asset.id,
            projectId: project.id,
            licenseeSub: sub,
            points: 0,
            status: "GRANTED",
          },
        });
      }

      await tx.asset.create({
        data: {
          projectId: project.id,
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
              notes: copyNotice(asset.name),
            },
          },
        },
      });

      return {
        license: await tx.assetLicense.findUniqueOrThrow({
          where: {
            assetId_projectId: { assetId: asset.id, projectId: project.id },
          },
        }),
        copied: true,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ("withdrawn" in result) {
      return conflict("This asset is no longer published");
    }
    if (result.copied) emitProjectUpdate(project.id, "asset.created");
    return Response.json({ license: result.license }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // A concurrent request got there first. Only a granted row means the copy
      // actually happened; anything else is still in progress.
      const license = await prisma.assetLicense.findUnique({
        where: {
          assetId_projectId: { assetId: asset.id, projectId: project.id },
        },
      });
      if (license?.status === "GRANTED") {
        return Response.json({ license, alreadyLicensed: true });
      }
      if (license) return conflict("Licensing is in progress, try again");
    }
    return mapError(err);
  }
}

/** Which of my projects already have this asset licensed. */
export async function GET(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const url = new URL(req.url);
  const assetId = url.searchParams.get("assetId")?.trim();
  if (!assetId) return badRequest("`assetId` is required");

  const licenses = await prisma.assetLicense.findMany({
    where: { assetId, licenseeSub: sub, status: "GRANTED" },
    select: { projectId: true },
  });

  return Response.json({ projectIds: licenses.map((l) => l.projectId) });
}
