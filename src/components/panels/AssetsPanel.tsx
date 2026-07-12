"use client";

import { useState } from "react";
import { ASSET_TYPES, type AssetData } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { VersionPills, EmptyState } from "@/components/ui";

function AssetCard({ asset }: { asset: AssetData }) {
  const [selected, setSelected] = useState(asset.versions[0]?.version ?? 1);
  const current = asset.versions.find((v) => v.version === selected) ?? asset.versions[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
      <div className="aspect-[4/5] bg-zinc-950">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.imageUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            设定图制作中
          </div>
        )}
      </div>
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
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  if (assets.length === 0) return <EmptyState text="资产尚未产出" />;

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
          全部 {assets.length}
        </button>
        {ASSET_TYPES.filter((t) => counts.has(t.key)).map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              typeFilter === t.key
                ? "bg-accent font-medium text-zinc-950"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {t.label} {counts.get(t.key)}
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
