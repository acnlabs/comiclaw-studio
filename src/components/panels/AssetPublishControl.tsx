"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import {
  canPublishAsAuthor,
  PUBLISHED,
  PUBLISH_DRAFT,
} from "@/lib/assetPublish";
import AssetPriceControl from "@/components/panels/AssetPriceControl";
import AssetTransferControl from "@/components/panels/AssetTransferControl";
import { ASSET_PUBLISH_CHANGED_EVENT } from "@/lib/assetEvents";
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
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const call = async (method: "POST" | "DELETE") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/user/assets/${asset.id}/publish`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body:
          method === "POST"
            ? JSON.stringify(
                selectedVersionId ? { versionId: selectedVersionId } : {}
              )
            : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || t("assetPublish.error"));
        return;
      }
      router.refresh();
      window.dispatchEvent(new Event(ASSET_PUBLISH_CHANGED_EVENT));
    } catch {
      setError(t("assetPublish.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-zinc-800/80 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          {isPublished
            ? asset.ownerType === "org"
              ? t("assetPublish.ownedByOrg")
              : asset.ownerType === "agent"
                ? t("assetPublish.ownedByAgent")
                : t("assetPublish.ownedByYou")
            : inFlight
              ? t("assetPublish.inFlight")
              : t("assetPublish.draft")}
        </span>
        <button
          type="button"
          disabled={busy || inFlight}
          onClick={() => void call(isPublished ? "DELETE" : "POST")}
          className={`rounded-full px-3.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
            isPublished
              ? "border border-zinc-600 text-zinc-300 hover:border-zinc-400"
              : "bg-accent text-zinc-950 hover:opacity-90"
          }`}
        >
          {busy
            ? t("assetPublish.working")
            : isPublished
              ? t("assetPublish.withdraw")
              : t("assetPublish.publish")}
        </button>
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
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
