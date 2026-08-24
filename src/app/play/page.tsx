import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { translate, type MessageKey } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { nextClaimIndex, spiralCoord } from "@/lib/plotSpiral";
import PlayWorldMap from "@/components/play/PlayWorldMap";
import PlayCreateButton from "@/components/play/PlayCreateButton";
import PlotTimelineCard, {
  type PlotTimelineItem,
} from "@/components/play/PlotTimelineCard";

export const dynamic = "force-dynamic";

const RANK_RAILS: MessageKey[] = ["play.sectionTop", "play.sectionTrending"];

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Play is the player door on AgentPlanet (智能体影游).
 *
 * The first block switches Timeline / Map. Top and Trending stay below.
 * Rails stay empty until a published 产物 exists. Do not list feed videos or
 * series here — those belong to 推荐 / 发现, not this product.
 */
export default async function PlayPage(props: {
  searchParams: Promise<{
    view?: string;
    created?: string;
    name?: string;
    x?: string;
    y?: string;
    studio?: string;
  }>;
}) {
  const locale = await getLocale();
  const t: T = (key, params) => translate(locale, key, params);
  const sp = await props.searchParams;
  const { view } = sp;
  const isMap = view === "map";
  const created =
    sp.created === "1" &&
    sp.name &&
    sp.x != null &&
    sp.y != null &&
    !Number.isNaN(Number(sp.x)) &&
    !Number.isNaN(Number(sp.y));
  const highlightPlot = created
    ? { x: Number(sp.x), y: Number(sp.y) }
    : null;

  const plots = await prisma.plot.findMany({
    select: {
      id: true,
      x: true,
      y: true,
      claimIndex: true,
      name: true,
      coverUrl: true,
      originProject: { select: { work: { select: { id: true } } } },
    },
    orderBy: { claimIndex: "asc" },
  });
  const timelinePlots: PlotTimelineItem[] = plots.map((p) => ({
    id: p.id,
    name: p.name,
    coverUrl: p.coverUrl,
    x: p.x,
    y: p.y,
    published: Boolean(p.originProject.work),
  }));
  const mapPlots = plots.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    name: p.name,
  }));
  const nextIndex = nextClaimIndex(plots.at(-1)?.claimIndex);
  const nextPlot = spiralCoord(nextIndex);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">{t("play.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("play.subtitle")}</p>
        </div>
        <PlayCreateButton
          nextX={nextPlot.x}
          nextY={nextPlot.y}
          nextIndex={nextIndex}
        />
      </div>

      {created ? (
        <PlotCreatedBanner
          name={sp.name!}
          x={Number(sp.x)}
          y={Number(sp.y)}
          studioPath={sp.studio}
          t={t}
        />
      ) : null}

      <div className="mt-8 space-y-10">
        <section>
          <div className="flex gap-2">
            <ViewTab href="/play" active={!isMap} label={t("play.viewTimeline")} />
            <ViewTab href="/play?view=map" active={isMap} label={t("play.viewMap")} />
          </div>
          {isMap ? (
            <PlayWorldMap
              plots={mapPlots}
              nextPlot={nextPlot}
              highlightPlot={highlightPlot}
            />
          ) : (
            <TimelineRail plots={timelinePlots} t={t} />
          )}
        </section>

        {RANK_RAILS.map((key) => (
          <section key={key}>
            <h2 className="text-lg font-semibold text-zinc-100">{t(key)}</h2>
            <EmptyRail />
          </section>
        ))}
      </div>
    </div>
  );
}

function PlotCreatedBanner({
  name,
  x,
  y,
  studioPath,
  t,
}: {
  name: string;
  x: number;
  y: number;
  studioPath?: string;
  t: T;
}) {
  return (
    <div
      role="status"
      className="mt-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-zinc-200"
    >
      <p>{t("play.createSuccess", { name, x, y })}</p>
      {studioPath ? (
        <Link
          href={studioPath}
          className="mt-2 inline-block text-accent hover:underline"
        >
          {t("play.createSuccessStudio")}
        </Link>
      ) : null}
    </div>
  );
}

function ViewTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm transition ${
        active
          ? "bg-accent font-medium text-zinc-950"
          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}

function TimelineRail({
  plots,
  t,
}: {
  plots: PlotTimelineItem[];
  t: T;
}) {
  if (plots.length === 0) {
    return (
      <>
        <EmptyRail featured />
        <p className="mt-3 text-sm text-zinc-500">{t("play.railEmpty")}</p>
      </>
    );
  }

  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
      {plots.map((plot) => (
        <PlotTimelineCard
          key={plot.id}
          plot={plot}
          coordLabel={t("play.plotCoord", { x: plot.x, y: plot.y })}
          statusLabel={t("play.plotPreparing")}
          enterLabel={
            plot.published ? t("play.plotEnter") : t("play.plotViewPlot")
          }
        />
      ))}
    </div>
  );
}

function EmptyRail({ featured = false }: { featured?: boolean }) {
  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: featured ? 4 : 6 }, (_, slot) => (
        <div
          key={slot}
          className={`shrink-0 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 ${
            featured ? "aspect-[2/3] w-40 sm:w-44" : "aspect-[2/3] w-32 sm:w-36"
          }`}
        />
      ))}
    </div>
  );
}

