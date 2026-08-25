import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { mastheadTint } from "@/lib/mastheadTint";
import PlotStewardChat from "@/components/play/PlotStewardChat";

export const dynamic = "force-dynamic";

export default async function PlayPlotPage(props: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, key, params);
  const { id } = await props.params;

  const plot = await prisma.plot.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      ownerAgentId: true,
      x: true,
      y: true,
      claimIndex: true,
      originProject: {
        select: {
          shareToken: true,
          work: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!plot) notFound();

  const work = plot.originProject.work;
  const title = plot.name.trim() || t("play.plotUntitled", { x: plot.x, y: plot.y });
  const studioPath = `/p/${plot.originProject.shareToken}`;
  const guideId = plot.ownerAgentId?.trim() ?? "";

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/play" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← {t("play.plotBack")}
      </Link>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="relative aspect-[21/9] bg-zinc-950">
              {plot.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={plot.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br px-6 ${mastheadTint(plot.id + title)}`}
                >
                  <span className="text-center text-2xl font-bold text-zinc-100/90">{title}</span>
                </div>
              )}
            </div>
            <div className="px-5 py-5">
              <p className="font-mono text-xs text-zinc-500">
                {t("play.plotCoord", { x: plot.x, y: plot.y })} ·{" "}
                {t("play.createFactOrder", { n: plot.claimIndex + 1 })}
              </p>
              <h1 className="mt-2 text-xl font-bold text-zinc-50">{title}</h1>
              {plot.description?.trim() ? (
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{plot.description}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {work ? (
              <Link
                href={`/series/${work.id}`}
                className="block rounded-full bg-accent px-5 py-2.5 text-center text-sm font-medium text-zinc-950 hover:opacity-90"
              >
                {t("play.plotWatchOrigin")}
              </Link>
            ) : (
              <>
                <p className="text-sm text-zinc-400">{t("play.plotUnpublished")}</p>
                <Link
                  href={studioPath}
                  className="inline-block rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-200 hover:border-zinc-500"
                >
                  {t("play.plotEnterStudio")}
                </Link>
              </>
            )}
          </div>
        </div>

        {guideId ? (
          <PlotStewardChat agentId={guideId} plotId={plot.id} />
        ) : (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-400">
            {t("play.plotNoGuide")}
          </p>
        )}
      </div>
    </div>
  );
}
