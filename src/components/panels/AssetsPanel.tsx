"use client";

import { useState } from "react";
import { ASSET_TYPE_KEYS, type AssetData } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { VersionPills, EmptyState, Modal, Badge } from "@/components/ui";

function AssetCard({ asset }: { asset: AssetData }) {
  const { t, fmtDate } = useT();
  const [selected, setSelected] = useState(asset.versions[0]?.version ?? 1);
  const [detailOpen, setDetailOpen] = useState(false);
  const current = asset.versions.find((v) => v.version === selected) ?? asset.versions[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
      <div className="aspect-[4/5] bg-zinc-950">
        {current ? (
          <button
            onClick={() => setDetailOpen(true)}
            className="h-full w-full cursor-zoom-in"
            title={t("detail.expand")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.imageUrl} alt={asset.name} className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            {t("panel.assets.inProgress")}
          </div>
        )}
      </div>

      {/* 详情弹层:大图 + 完整信息 */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)}>
        {current && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pr-10">
              <Badge>{t(`assetType.${asset.type}` as MessageKey)}</Badge>
              <h3 className="text-lg font-semibold text-zinc-100">{asset.name}</h3>
              <span className="text-xs text-zinc-500">
                V{current.version} · {fmtDate(current.createdAt)}
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.imageUrl}
              alt={asset.name}
              className="max-h-[60vh] w-full rounded-xl bg-zinc-950 object-contain"
            />
            {asset.description && (
              <p className="text-sm leading-relaxed text-zinc-300">{asset.description}</p>
            )}
            {current.notes && (
              <p className="text-sm text-amber-200/80">V{current.version}:{current.notes}</p>
            )}
            {current.audioUrl && (
              <div>
                <p className="mb-1 text-xs text-zinc-500">{t("asset.voice")}</p>
                <audio src={current.audioUrl} controls preload="none" className="h-9 w-full" />
              </div>
            )}
            <VersionPills
              versions={asset.versions.map((v) => v.version)}
              selected={current.version}
              onSelect={setSelected}
            />
          </div>
        )}
      </Modal>
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-zinc-100">{asset.name}</h3>
          {current && (
            <span className="text-xs text-zinc-500">{fmtDate(current.createdAt)}</span>
          )}
        </div>
        {asset.description && (
          <p className="text-xs leading-relaxed text-zinc-400">{asset.description}</p>
        )}
        {current?.notes && (
          <p className="text-xs text-amber-200/80">V{current.version}:{current.notes}</p>
        )}
        {current?.audioUrl && (
          <div>
            <p className="mb-1 text-xs text-zinc-500">{t("asset.voice")}</p>
            <audio src={current.audioUrl} controls preload="none" className="h-8 w-full" />
          </div>
        )}
        <VersionPills
          versions={asset.versions.map((v) => v.version)}
          selected={current?.version ?? 1}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}

export default function AssetsPanel({ assets }: { assets: AssetData[] }) {
  const { t } = useT();
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  if (assets.length === 0) return <EmptyState text={t("panel.assets.empty")} />;

  const counts = new Map<string, number>();
  for (const a of assets) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);

  const filtered = typeFilter === "ALL" ? assets : assets.filter((a) => a.type === typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter("ALL")}
          className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
            typeFilter === "ALL"
              ? "bg-accent font-medium text-zinc-950"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {t("panel.assets.all", { n: assets.length })}
        </button>
        {ASSET_TYPE_KEYS.filter((key) => counts.has(key)).map((key) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              typeFilter === key
                ? "bg-accent font-medium text-zinc-950"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {t(`assetType.${key}` as MessageKey)} {counts.get(key)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}
