"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { ASSET_PUBLISH_CHANGED_EVENT } from "@/lib/assetEvents";

/**
 * Price the usage rights of a published asset.
 *
 * Pricing is not the same act as publishing: publishing registers ownership,
 * this decides what someone pays to use it. A failed listing is reported
 * rather than swallowed — believing your asset is on sale when it is not is
 * the one outcome worth interrupting for.
 */
export default function AssetPriceControl({
  assetId,
  licensePoints,
}: {
  assetId: string;
  licensePoints: number;
}) {
  const { getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(licensePoints));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const points = Number.parseInt(value, 10);
    if (!Number.isFinite(points) || points < 0) {
      setError(t("assetPrice.error"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/user/assets/${assetId}/publish`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licensePoints: points }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        listingBlocked?: boolean;
      } | null;
      if (!res.ok) {
        setError(data?.error || t("assetPrice.error"));
        return;
      }
      if (data?.listingBlocked) {
        setError(t("assetPrice.blocked"));
      } else {
        setEditing(false);
      }
      router.refresh();
      window.dispatchEvent(new Event(ASSET_PUBLISH_CHANGED_EVENT));
    } catch {
      setError(t("assetPrice.error"));
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-zinc-500">
          {licensePoints > 0
            ? t("assetPrice.paid", { credits: String(licensePoints) })
            : t("assetPrice.free")}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          {t("assetPrice.edit")}
        </button>
        {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor={`price-${assetId}`}>
        {t("assetPrice.label")}
      </label>
      <input
        id={`price-${assetId}`}
        type="number"
        min={0}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-zinc-950 disabled:opacity-50"
      >
        {t("assetPrice.save")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setEditing(false);
          setValue(String(licensePoints));
          setError(null);
        }}
        className="text-[11px] text-zinc-500 hover:text-zinc-300"
      >
        {t("assetPrice.cancel")}
      </button>
      <p className="w-full text-[11px] leading-relaxed text-zinc-600">
        {t("assetPrice.hint")}
      </p>
      {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
