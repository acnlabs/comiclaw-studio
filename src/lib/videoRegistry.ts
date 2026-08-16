import { prisma } from "@/lib/db";
import {
  changeAssetOwner,
  getAssetRegistration,
  patchAsset,
  registerAsset,
  storeConfigured,
} from "@/lib/agentplanet";
import { assetRef, type AssetOwner } from "@/lib/assetRegistry";
import {
  resolveVideoRegistrySubject,
  videoRegisterArgs,
} from "@/lib/videoRegistryRules";

export {
  resolveVideoRegistrySubject,
  videoRegisterArgs,
  type VideoRegistrySubject,
} from "@/lib/videoRegistryRules";

/**
 * A published ComicLaw film is registered as `asset_kind=video` so Agent
 * Launch can list it. Video is not a Store product — do not call
 * upsertAssetListing from this path.
 */

export type VideoRegistryStatus =
  | "registered"
  | "exists"
  | "failed"
  | "skipped";

export type VideoRegistrySkipReason = "unconfigured" | "no_principal";

export type VideoRegistryResult =
  | {
      status: "registered" | "exists" | "failed";
      assetRef: string;
      owner: AssetOwner;
      boundAgentId: string | null;
    }
  | { status: "skipped"; reason: VideoRegistrySkipReason };

/**
 * Best-effort look-up of the agent this film is about. Explicit listing
 * ids are applied by the caller; this only reads project-local records.
 */
export async function findAppearingAgentId(args: {
  projectId: string;
  workId: string;
}): Promise<string | null> {
  const fromSource = await prisma.agentCharacter.findFirst({
    where: { sourceProjectId: args.projectId, acnAgentId: { not: null } },
    select: { acnAgentId: true },
    orderBy: { createdAt: "asc" },
  });
  if (fromSource?.acnAgentId) return fromSource.acnAgentId;

  const fromCasting = await prisma.castingLicense.findFirst({
    where: {
      projectId: args.projectId,
      status: "GRANTED",
      character: { acnAgentId: { not: null } },
    },
    select: { character: { select: { acnAgentId: true } } },
  });
  if (fromCasting?.character.acnAgentId) return fromCasting.character.acnAgentId;

  const fromAsset = await prisma.asset.findFirst({
    where: {
      projectId: args.projectId,
      type: "CHARACTER",
      character: { acnAgentId: { not: null } },
    },
    select: { character: { select: { acnAgentId: true } } },
  });
  if (fromAsset?.character?.acnAgentId) return fromAsset.character.acnAgentId;

  const fromWork = await prisma.workCast.findFirst({
    where: { workId: args.workId, character: { acnAgentId: { not: null } } },
    select: { character: { select: { acnAgentId: true } } },
  });
  return fromWork?.character.acnAgentId ?? null;
}

async function realignExisting(
  workId: string,
  subject: { owner: AssetOwner; boundAgentId: string | null },
  displayName: string
) {
  await patchAsset("video", workId, {
    displayName,
    boundAgentId: subject.boundAgentId,
  });
  const current = await getAssetRegistration("video", workId);
  if (
    current &&
    (current.owner_type !== subject.owner.type ||
      current.owner_id !== subject.owner.id)
  ) {
    const moved = await changeAssetOwner("video", workId, subject.owner);
    if (!moved) {
      console.error("[videoRegistry] change-owner failed", workId);
      return "failed" as const;
    }
  }
  return "exists" as const;
}

/**
 * Register the published Work as `comiclaw:video:{workId}`.
 *
 * ComicLaw listing has already succeeded; a registry miss must not roll
 * that back. Callers surface `status` so Launch emptiness is not silent.
 */
export async function registerPublishedVideo(args: {
  workId: string;
  displayName: string;
  appearingAgentId?: string | null;
  publisherAgentId?: string | null;
  filmAuthorAgentId?: string | null;
  projectOwnerUserId?: string | null;
}): Promise<VideoRegistryResult> {
  if (!storeConfigured()) {
    return { status: "skipped", reason: "unconfigured" };
  }

  const subject = resolveVideoRegistrySubject(args);
  if (!subject) {
    console.error("[videoRegistry] no principal for", args.workId);
    return { status: "skipped", reason: "no_principal" };
  }

  const payload = videoRegisterArgs({
    workId: args.workId,
    displayName: args.displayName,
    subject,
  });
  const ref = assetRef("video", args.workId);
  const registration = await registerAsset(payload);
  if (registration === "failed") {
    console.error("[videoRegistry] register failed", ref);
    return {
      status: "failed",
      assetRef: ref,
      owner: subject.owner,
      boundAgentId: subject.boundAgentId,
    };
  }
  if (registration === "exists") {
    const aligned = await realignExisting(args.workId, subject, args.displayName);
    if (aligned === "failed") {
      return {
        status: "failed",
        assetRef: ref,
        owner: subject.owner,
        boundAgentId: subject.boundAgentId,
      };
    }
  }
  return {
    status: registration,
    assetRef: ref,
    owner: subject.owner,
    boundAgentId: subject.boundAgentId,
  };
}
