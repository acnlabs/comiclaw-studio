import type { MessageKey } from "@/lib/i18n";
import AssetLicenseButton from "@/components/asset/AssetLicenseButton";

export type PublishedAssetCard = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  ownerType: string | null;
};

export default function PublishedAssetGrid({
  assets,
  typeLabel,
  ownerLabel,
}: {
  assets: PublishedAssetCard[];
  typeLabel: (key: MessageKey) => string;
  ownerLabel: (ownerType: string | null) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((a) => (
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
              {typeLabel(`assetType.${a.type}` as MessageKey)}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-zinc-100">{a.name}</h3>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {ownerLabel(a.ownerType)}
              </p>
            </div>
            <div className="mt-auto">
              <AssetLicenseButton assetId={a.id} assetName={a.name} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
