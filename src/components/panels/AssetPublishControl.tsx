"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { canPublishAsAuthor, PUBLISHED, PUBLISH_DRAFT } from "@/lib/assetPublish";
import AssetPriceControl from "@/components/panels/AssetPriceControl";
import AssetTransferControl from "@/components/panels/AssetTransferControl";
import AssetPublishButton from "@/components/asset/AssetPublishButton";
import AssetStateLabel from "@/components/asset/AssetStateLabel";
import type { AssetData } from "@/lib/types";

/**
 * Publish a project asset to the AgentPlanet registry.
 *
 * The server is the authority on who may publish; this only decides whether to
 * offer the action, so a contributor's card stays free of a button they cannot
 * use. Signed-out and non-owner viewers see nothing.
 */
export default function AssetPublishControl({
  asset,
  projectOwnerUserId,
  projectVisibility,
  selectedVersionId,
}: {
  asset: AssetData;
  projectOwnerUserId: string | null | undefined;
  projectVisibility: string | undefined;
  selectedVersionId: string | undefined;
}) {
  const { isAuthenticated, user } = useAuth0();
  const { t } = useT();

  const sub = user?.sub;
  const state = asset.publishState ?? PUBLISH_DRAFT;
  const isPublished = state === PUBLISHED;
  const inFlight = state !== PUBLISH_DRAFT && !isPublished;

  if (!isAuthenticated || !sub || !projectOwnerUserId) return null;
  if (projectOwnerUserId !== sub) return null;
  if (
    !canPublishAsAuthor({
      authorUserId: asset.authorUserId ?? null,
      authorAgentId: asset.authorAgentId ?? null,
      authorKey: asset.authorKey ?? "legacy",
      projectVisibility: projectVisibility ?? "PRIVATE",
      publisherSub: sub,
    })
  ) {
    return null;
  }

  return (
    <div className="border-t border-zinc-800/80 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AssetStateLabel publishState={state} ownerType={asset.ownerType} />
        <AssetPublishButton
          assetId={asset.id}
          publishState={state}
          versionId={selectedVersionId}
        />
      </div>
      {isPublished ? (
        <AssetPriceControl
          assetId={asset.id}
          licensePoints={asset.licensePoints ?? 0}
        />
      ) : null}
      {isPublished ? (
        <AssetTransferControl
          assetId={asset.id}
          ownerType={asset.ownerType}
          ownerId={asset.ownerId}
        />
      ) : null}
      {!isPublished && !inFlight ? (
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          {t("assetPublish.hint")}
        </p>
      ) : null}
    </div>
  );
}
