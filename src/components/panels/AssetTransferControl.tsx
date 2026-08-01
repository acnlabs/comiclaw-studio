"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { ASSET_PUBLISH_CHANGED_EVENT } from "@/lib/assetEvents";

type OrgOption = { id: string; name: string };

/**
 * Move a published asset between your own name and an Org you govern.
 *
 * The Org list is fetched on demand rather than with the project: most assets
 * are never transferred, and most owners govern no Org at all.
 */
export default function AssetTransferControl({
  assetId,
  ownerType,
  ownerId,
}: {
  assetId: string;
  ownerType: string | null | undefined;
  ownerId: string | null | undefined;
}) {
  const { getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heldByOrg = ownerType === "org";
  // Only the governor's own view offers a way back out, and the server checks
  // that again; this just avoids showing a button that would 403.
  const governsHolder =
    heldByOrg && orgs !== null && orgs.some((o) => o.id === ownerId);

  const token = () =>
    getAccessTokenSilently({ authorizationParams: { audience: AUTH0_AUDIENCE } });

  const loadOrgs = async () => {
    setError(null);
    try {
      const res = await fetch("/api/user/my-columns", {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        columns: { name: string; acnOrgId: string | null }[];
      };
      const seen = new Set<string>();
      setOrgs(
        data.columns.flatMap((c) =>
          c.acnOrgId && !seen.has(c.acnOrgId) && seen.add(c.acnOrgId)
            ? [{ id: c.acnOrgId, name: c.name }]
            : []
        )
      );
      setOpen(true);
    } catch {
      setError(t("assetTransfer.error"));
    }
  };

  const transfer = async (orgId?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/assets/${assetId}/transfer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orgId ? { orgId } : {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || t("assetTransfer.error"));
        return;
      }
      setOpen(false);
      router.refresh();
      window.dispatchEvent(new Event(ASSET_PUBLISH_CHANGED_EVENT));
    } catch {
      setError(t("assetTransfer.error"));
    } finally {
      setBusy(false);
    }
  };

  // An Org holds it: the only move on offer is taking it back, and only for
  // someone who turns out to govern that Org.
  if (heldByOrg) {
    if (orgs === null) {
      return (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => void loadOrgs()}
            className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            {t("assetTransfer.takeBack")}
          </button>
          {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
        </div>
      );
    }
    if (!governsHolder) return null;
    return (
      <div className="mt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void transfer()}
          className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
        >
          {busy ? t("assetTransfer.working") : t("assetTransfer.takeBack")}
        </button>
        {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={() => void loadOrgs()}
          className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          {t("assetTransfer.toOrg")}
        </button>
        {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  if (orgs !== null && orgs.length === 0) {
    return (
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
        {t("assetTransfer.noOrgs")}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) => e.target.value && void transfer(e.target.value)}
        aria-label={t("assetTransfer.pick")}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
      >
        <option value="" disabled>
          {busy ? t("assetTransfer.working") : t("assetTransfer.pick")}
        </option>
        {(orgs ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-zinc-600">{t("assetTransfer.hint")}</span>
      {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
