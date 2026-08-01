"use client";

import { useState } from "react";
import AssetLicenseButton from "@/components/asset/AssetLicenseButton";

export type PublishedAssetCard = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  ownerType: string | null;
  licensePoints: number;
};

type Filter = "all" | "CHARACTER" | "SCENE" | "PROP";

const FILTERS: Filter[] = ["all", "CHARACTER", "SCENE", "PROP"];

/**
 * Labels arrive as plain strings, not formatter callbacks: this renders on the
 * client and a server page cannot hand a function across that boundary.
 */
export default function PublishedAssetGrid({
  assets,
  typeLabels,
  ownerLabels,
  allLabel,
}: {
  assets: PublishedAssetCard[];
  typeLabels: Record<string, string>;
  ownerLabels: { org: string; agent: string; user: string };
  allLabel: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});
  const shown = filter === "all" ? assets : assets.filter((a) => a.type === filter);

  return (
    <>
      {/* Only offer a filter for a kind that is actually on the page. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.filter((f) => f === "all" || counts[f]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
              filter === f
                ? "bg-accent text-zinc-950"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {f === "all" ? allLabel : typeLabels[f]}
            <span className="ml-1.5 opacity-70">
              {f === "all" ? assets.length : counts[f]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {shown.map((a) => (
        <div
          key={a.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50"
        >
          <div className="relative aspect-[3/4] bg-zinc-950">
            {a.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.imageUrl}
                alt={a.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl">
                🎬
              </div>
            )}
            <span className="absolute top-2 left-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-accent">
              {typeLabels[a.type] ?? a.type}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-zinc-100">{a.name}</h3>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {a.ownerType === "org"
                  ? ownerLabels.org
                  : a.ownerType === "agent"
                    ? ownerLabels.agent
                    : ownerLabels.user}
              </p>
            </div>
            <div className="mt-auto">
              <AssetLicenseButton
                assetId={a.id}
                assetName={a.name}
                licensePoints={a.licensePoints}
              />
            </div>
          </div>
        </div>
      ))}
      </div>
    </>
  );
}
