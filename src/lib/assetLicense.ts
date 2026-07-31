import { LEGACY_AUTHOR_KEY } from "@/lib/authorKey";
import { PUBLISHED } from "@/lib/assetPublish";

/**
 * Licensing a published asset into a project.
 *
 * `CastingLicense` only speaks about `AgentCharacter`, so a published scene or
 * prop could be registered and still be unusable. This mirrors that flow for
 * assets: check eligibility, then copy the pinned version into the licensee's
 * project so their pipeline has something to work with.
 *
 * Free only for now — paid licensing reuses the same table.
 */

export type LicenseCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_published"
        | "no_pinned_version"
        | "not_your_project"
        | "already_licensed";
    };

export function checkLicensable(args: {
  publishState: string;
  publishedVersionId: string | null;
  projectOwnerUserId: string | null;
  requesterSub: string;
  existingStatus?: string | null;
}): LicenseCheck {
  if (args.publishState !== PUBLISHED) {
    return { ok: false, reason: "not_published" };
  }
  // The pinned version is what the buyer gets; without it there is nothing to
  // hand over even though the asset claims to be published.
  if (!args.publishedVersionId) {
    return { ok: false, reason: "no_pinned_version" };
  }
  if (
    !args.projectOwnerUserId ||
    args.projectOwnerUserId !== args.requesterSub
  ) {
    return { ok: false, reason: "not_your_project" };
  }
  if (args.existingStatus === "GRANTED") {
    return { ok: false, reason: "already_licensed" };
  }
  return { ok: true };
}

export type CopyAuthor = {
  authorUserId: string | null;
  authorAgentId: string | null;
  authorKey: string;
};

/**
 * Who the copy belongs to inside the licensee's project.
 *
 * On a PUBLIC entry everything is attributed, so the copy is the licensee's own
 * contribution and edit-own applies to them. A PRIVATE delivery project keeps
 * the pre-authorship marker so studio and workers can keep iterating on it.
 */
export function copyAuthorFor(args: {
  projectVisibility: string;
  licenseeSub: string;
}): CopyAuthor {
  if (args.projectVisibility === "PUBLIC") {
    return {
      authorUserId: args.licenseeSub,
      authorAgentId: null,
      authorKey: `user:${args.licenseeSub}`,
    };
  }
  return {
    authorUserId: null,
    authorAgentId: null,
    authorKey: LEGACY_AUTHOR_KEY,
  };
}

/** The copy is a plain project asset again: a draft, not a second registration. */
export function copyNotice(sourceName: string): string {
  return `来自资产授权 / Licensed asset: ${sourceName}`;
}
