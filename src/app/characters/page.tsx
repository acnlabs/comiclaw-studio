import Link from "next/link";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import MyCharacters from "@/components/MyCharacters";
import PublishedAssetGrid from "@/components/asset/PublishedAssetGrid";
import { PUBLISHED } from "@/lib/assetPublish";

export const dynamic = "force-dynamic";

// 智能体角色市场:公开的数字人角色卡
export default async function CharactersPage() {
  const locale = await getLocale();
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);

  const [characters, publishedAssets] = await Promise.all([
    prisma.agentCharacter.findMany({
      where: { isPublic: true },
      orderBy: { updatedAt: "desc" },
    }),
    // Publishing is an explicit act, so a published asset is on offer no matter
    // how private the project it came from is.
    prisma.asset.findMany({
      where: { publishState: PUBLISHED },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: {
        id: true,
        type: true,
        name: true,
        description: true,
        ownerType: true,
        publishedVersion: { select: { imageUrl: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{t("char.title")}</h1>
      <p className="mt-1 mb-8 max-w-3xl text-sm text-zinc-500">{t("char.subtitle")}</p>

      <MyCharacters />

      {characters.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {t("char.empty")}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {characters.map((c) => (
            <Link
              key={c.id}
              href={`/characters/${c.id}`}
              className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600"
            >
              <div className="relative aspect-[3/4] bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {c.openForCasting && (
                  <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-zinc-950">
                    {t("char.castingBadge")}
                  </span>
                )}
              </div>
              <div className="px-3.5 py-3">
                <h3 className="truncate font-medium text-zinc-100">{c.name}</h3>
                {(c.agentName || c.tagline) && (
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {c.agentName ?? c.tagline}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {publishedAssets.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-lg font-semibold text-zinc-100">
            {t("publishedAssets.title")}
          </h2>
          <p className="mt-1 mb-6 max-w-2xl text-sm text-zinc-500">
            {t("publishedAssets.subtitle")}
          </p>
          <PublishedAssetGrid
            assets={publishedAssets.map((a) => ({
              id: a.id,
              type: a.type,
              name: a.name,
              description: a.description,
              imageUrl: a.publishedVersion?.imageUrl ?? null,
              ownerType: a.ownerType,
            }))}
            typeLabel={(key) => t(key)}
            ownerLabel={(ownerType) =>
              t(
                ownerType === "org"
                  ? "publishedAssets.heldByOrg"
                  : ownerType === "agent"
                    ? "publishedAssets.heldByAgent"
                    : "publishedAssets.heldByUser"
              )
            }
          />
        </section>
      ) : null}
    </div>
  );
}
