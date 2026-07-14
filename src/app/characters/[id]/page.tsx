import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CharacterDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
  const { id } = await props.params;

  const c = await prisma.agentCharacter.findUnique({ where: { id } });
  if (!c || !c.isPublic) notFound();

  const gallery = (c.gallery ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const tags = (c.styleTags ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // 参演作品:来源项目发布的成片作品(简单关联)
  const works = c.sourceProjectId
    ? await prisma.work.findMany({
        where: { projectId: c.sourceProjectId },
        select: { id: true, title: true, coverUrl: true, kind: true },
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
        {/* 形象 */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imageUrl} alt={c.name} className="w-full object-cover" />
          </div>
          {gallery.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-zinc-500">{t("char.gallery")}</p>
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={g}
                    alt=""
                    className="aspect-square w-full rounded-lg border border-zinc-800 object-cover"
                  />
                ))}
              </div>
            </div>
          )}
          {c.audioUrl && (
            <div>
              <p className="mb-1 text-xs text-zinc-500">{t("char.voice")}</p>
              <audio src={c.audioUrl} controls preload="none" className="h-9 w-full" />
            </div>
          )}
        </div>

        {/* 信息 */}
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-50">{c.name}</h1>
              {c.openForCasting && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                  {t("char.castingBadge")}
                </span>
              )}
            </div>
            {c.tagline && <p className="mt-1 text-sm text-zinc-400">{c.tagline}</p>}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {c.persona && (
            <div>
              <h2 className="mb-1 text-sm font-medium text-zinc-500">{t("char.persona")}</h2>
              <p className="text-sm leading-relaxed text-zinc-300">{c.persona}</p>
            </div>
          )}

          {/* 关联智能体信息 */}
          {(c.agentName || c.agentSummary || c.agentUrl) && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <h2 className="mb-1 text-xs font-medium text-zinc-500">{t("char.byAgent")}</h2>
              {c.agentName && <p className="font-medium text-zinc-100">{c.agentName}</p>}
              {c.agentSummary && (
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{c.agentSummary}</p>
              )}
              {c.agentUrl && (
                <a
                  href={c.agentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
                >
                  {t("char.viewAgent")} →
                </a>
              )}
            </div>
          )}

          {works.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-zinc-500">{t("char.works")}</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {works.map((w) => (
                  <Link key={w.id} href={`/series/${w.id}`} className="group">
                    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                      {w.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.coverUrl} alt={w.title} className="aspect-video w-full object-cover" />
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-lg">🎬</div>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-400">{w.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
