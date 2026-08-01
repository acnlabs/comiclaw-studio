"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { ASSET_PUBLISH_CHANGED_EVENT } from "@/lib/assetEvents";
import { PUBLISHED, PUBLISH_DRAFT } from "@/lib/assetPublish";

/**
 * Publish an asset to the registry, or withdraw it.
 *
 * Shared by the project workspace and the Cast page so the two cannot drift
 * into behaving differently on the same asset. Who is allowed to press it is
 * the caller's decision — and the server's.
 */
export default function AssetPublishButton({
  assetId,
  publishState,
  versionId,
  onDone,
}: {
  assetId: string;
  publishState: string;
  /** Pin this take when publishing; defaults to the newest */
  versionId?: string;
  onDone?: () => void;
}) {
  const { getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = publishState === PUBLISHED;
  const inFlight = publishState !== PUBLISH_DRAFT && !isPublished;

  const call = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/user/assets/${assetId}/publish`, {
        method: isPublished ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: isPublished
          ? undefined
          : JSON.stringify(versionId ? { versionId } : {}),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        listingBlocked?: boolean;
      } | null;
      if (!res.ok) {
        setError(data?.error || t("assetPublish.error"));
        return;
      }
      if (data?.listingBlocked) setError(t("assetPrice.blocked"));
      router.refresh();
      window.dispatchEvent(new Event(ASSET_PUBLISH_CHANGED_EVENT));
      onDone?.();
    } catch {
      setError(t("assetPublish.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy || inFlight}
        onClick={() => void call()}
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
      {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
    </>
  );
}
