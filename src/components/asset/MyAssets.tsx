"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { ASSET_PUBLISH_CHANGED_EVENT } from "@/lib/assetEvents";
import { PUBLISHED } from "@/lib/assetPublish";
import AssetPublishButton from "@/components/asset/AssetPublishButton";
import AssetStateLabel from "@/components/asset/AssetStateLabel";
import AssetPriceControl from "@/components/panels/AssetPriceControl";
import AssetTransferControl from "@/components/panels/AssetTransferControl";
import type { MessageKey } from "@/lib/i18n";

type MyAsset = {
  id: string;
  type: string;
  name: string;
  publishState: string;
  licensePoints: number;
  ownerType: string | null;
  ownerId: string | null;
  imageUrl: string | null;
  latestVersionId: string | null;
  project: { name: string; shareToken: string } | null;
  licensedCount: number;
  canPublish: boolean;
  canManage: boolean;
};

/**
 * Everything you hold, in one place.
 *
 * The workspace shows a project's assets, which leaves anything made outside a
 * project — a character built straight in the marketplace — with nowhere to be
 * managed from. This is that place, and project assets appear here too so
 * "where do I price this?" has one answer instead of two.
 */
export default function MyAssets() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const [assets, setAssets] = useState<MyAsset[] | null>(null);

  const fetchAssets = useCallback(async (): Promise<MyAsset[]> => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch("/api/user/assets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.assets ?? [];
    } catch {
      return [];
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let active = true;
    (async () => {
      const next = await fetchAssets();
      if (active) setAssets(next);
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, fetchAssets]);

  const refresh = useCallback(async () => {
    setAssets(await fetchAssets());
  }, [fetchAssets]);

  // Publishing and transferring happen in child components; this list holds the
  // state they changed, so it has to hear about it.
  useEffect(() => {
    const onChanged = () => void refresh();
    window.addEventListener(ASSET_PUBLISH_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ASSET_PUBLISH_CHANGED_EVENT, onChanged);
  }, [refresh]);

  // A browse page should not grow an empty box for every signed-out visitor.
  if (!assets || assets.length === 0) return null;

  return (
    <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
      <h2 className="text-lg font-semibold text-zinc-100">{t("myAssets.title")}</h2>
      <p className="mt-1 mb-4 text-sm text-zinc-500">{t("myAssets.subtitle")}</p>

      <ul className="space-y-3">
        {assets.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
          >
            {a.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.imageUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xl">
                🎬
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="truncate font-medium text-zinc-100">{a.name}</h3>
                <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400">
                  {t(`assetType.${a.type}` as MessageKey)}
                </span>
              </div>

              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {a.project ? (
                  <Link
                    href={`/p/${a.project.shareToken}`}
                    className="underline-offset-2 hover:text-zinc-300 hover:underline"
                  >
                    {t("myAssets.fromProject", { name: a.project.name })}
                  </Link>
                ) : (
                  t("myAssets.standalone")
                )}
                {a.licensedCount > 0
                  ? ` · ${t("myAssets.licensed", { count: String(a.licensedCount) })}`
                  : ""}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <AssetStateLabel
                  publishState={a.publishState}
                  ownerType={a.ownerType}
                  className="text-[11px] text-zinc-500"
                />
                {a.canManage && a.publishState === PUBLISHED ? (
                  <AssetPriceControl assetId={a.id} licensePoints={a.licensePoints} />
                ) : null}
                {a.canManage && a.publishState === PUBLISHED ? (
                  <AssetTransferControl
                    assetId={a.id}
                    ownerType={a.ownerType}
                    ownerId={a.ownerId}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {a.publishState === PUBLISHED ? (
                a.canManage ? (
                  <AssetPublishButton
                    assetId={a.id}
                    publishState={a.publishState}
                    onDone={refresh}
                  />
                ) : null
              ) : a.canPublish ? (
                <AssetPublishButton
                  assetId={a.id}
                  publishState={a.publishState}
                  versionId={a.latestVersionId ?? undefined}
                  onDone={refresh}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
