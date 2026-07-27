import Link from "next/link";
import { Noto_Serif_SC } from "next/font/google";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { safeMediaUrl } from "@/lib/columnTimeline";
import ColumnAgentCta from "@/components/column/ColumnAgentCta";
import CopyOrgButton from "@/components/column/CopyOrgButton";
import CopyTextButton from "@/components/column/CopyTextButton";

const display = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export type ColumnEntry = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  shareToken: string;
  entryOrder: number | null;
  createdAt: string;
};

export type ColumnViewData = {
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  acnOrgId: string | null;
  /** Already newest-first from server; view does not re-sort. */
  entries: ColumnEntry[];
};

export default async function ColumnPageView({
  column,
}: {
  column: ColumnViewData;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const timeline = column.entries;
  const current = timeline[0] ?? null;
  const heroCover = safeMediaUrl(column.coverUrl);
  const currentCover = current ? safeMediaUrl(current.coverUrl) : null;

  return (
    <main className="relative flex-1 overflow-x-hidden">
      <section className="relative isolate min-h-[min(92vh,880px)] overflow-hidden">
        <div aria-hidden className="absolute inset-0 column-hero-bg" />
        {heroCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroCover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#08080c]/95 via-[#08080c]/70 to-[#08080c]/85"
        />
        <div aria-hidden className="column-hero-grain absolute inset-0 opacity-[0.35]" />

        <div className="relative mx-auto flex min-h-[min(92vh,880px)] w-full max-w-5xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20">
          <p className="column-reveal text-[11px] tracking-[0.28em] text-accent/90 uppercase">
            {t("column.eyebrow")}
          </p>
          <h1
            className={`${display.className} column-reveal column-reveal-delay-1 mt-4 max-w-[14ch] text-[clamp(3rem,12vw,5.75rem)] leading-[0.95] font-bold tracking-tight text-zinc-50`}
          >
            {column.name}
          </h1>
          <p className="column-reveal column-reveal-delay-2 mt-5 max-w-md text-base leading-relaxed text-zinc-300 sm:text-lg">
            {column.description?.trim() || t("column.defaultTagline")}
          </p>
          <div className="column-reveal column-reveal-delay-3 mt-8 flex flex-wrap items-center gap-3">
            {current ? (
              <a
                href="#current-entry"
                className="inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
              >
                {t("column.ctaCurrent")}
              </a>
            ) : null}
            <ColumnAgentCta
              label={t("column.ctaAgent")}
              returnPath={`/columns/${column.slug}`}
            />
          </div>
        </div>
      </section>

      <section
        id="current-entry"
        className="relative border-t border-zinc-800/80 bg-gradient-to-b from-[#101018] to-[#0b0b10] px-5 py-16 sm:px-8"
      >
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-[11px] tracking-[0.22em] text-zinc-500 uppercase">
            {t("column.currentLabel")}
          </p>
          {current ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                {current.entryOrder != null ? (
                  <p className="text-sm text-accent">
                    {t("column.entryN", { n: current.entryOrder })}
                  </p>
                ) : null}
                <h2
                  className={`${display.className} mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl`}
                >
                  {current.name}
                </h2>
                {current.description ? (
                  <p className="mt-4 max-w-2xl text-base leading-relaxed whitespace-pre-wrap text-zinc-400">
                    {current.description}
                  </p>
                ) : null}
                <Link
                  href={`/p/${current.shareToken}`}
                  className="mt-8 inline-flex text-sm font-medium text-accent underline-offset-4 transition hover:underline"
                >
                  {t("column.openEntry")} →
                </Link>
              </div>
              {currentCover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentCover}
                  alt=""
                  className="column-cover-float aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="column-cover-float aspect-[16/10] w-full bg-[radial-gradient(circle_at_30%_20%,rgba(245,184,61,0.22),transparent_55%),linear-gradient(160deg,#1a1a24,#0d0d12)]"
                />
              )}
            </div>
          ) : (
            <p className="mt-6 max-w-lg text-sm text-zinc-500">{t("column.timelineEmpty")}</p>
          )}
        </div>
      </section>

      <section className="border-t border-zinc-800/80 px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className={`${display.className} text-2xl font-semibold text-zinc-50`}>
            {t("column.timelineTitle")}
          </h2>
          {timeline.length === 0 ? (
            <p className="mt-8 text-sm text-zinc-500">{t("column.timelineEmpty")}</p>
          ) : (
            <ol className="column-timeline relative mt-10 space-y-0">
              {timeline.map((entry, i) => {
                const isCurrent = current?.id === entry.id;
                const delay = Math.min(0.05 + i * 0.05, 0.45);
                return (
                  <li
                    key={entry.id}
                    className="column-timeline-item relative grid grid-cols-[28px_1fr] gap-4 py-5 sm:grid-cols-[36px_1fr]"
                    style={{ animationDelay: `${delay}s` }}
                  >
                    <div className="relative flex justify-center">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 rounded-full ${
                          isCurrent
                            ? "bg-accent ring-2 ring-accent/35 ring-offset-2 ring-offset-[#0b0b10]"
                            : "bg-zinc-600"
                        }`}
                      />
                    </div>
                    <Link
                      href={`/p/${entry.shareToken}`}
                      className="group min-w-0 border-b border-zinc-800/90 pb-5 transition-colors hover:border-accent/40"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {entry.entryOrder != null ? (
                          <span className="text-xs tracking-wide text-zinc-500">
                            {t("column.entryN", { n: entry.entryOrder })}
                          </span>
                        ) : null}
                        <span className="text-xs text-zinc-600">
                          {fmtDate(entry.createdAt, locale)}
                        </span>
                      </div>
                      <p
                        className={`${display.className} mt-1 text-lg text-zinc-100 transition-colors group-hover:text-accent sm:text-xl`}
                      >
                        {entry.name}
                      </p>
                      {entry.description ? (
                        <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-zinc-500">
                          {entry.description}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <section className="border-t border-zinc-800/80 px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className={`${display.className} text-2xl font-semibold text-zinc-50`}>
            {t("column.modesTitle")}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
            {t("column.modesBody")}
          </p>
        </div>
      </section>

      <section className="border-t border-zinc-800/80 px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className={`${display.className} text-2xl font-semibold text-zinc-50`}>
            {t("column.agentGuideTitle")}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
            {t("column.agentGuideBody")}
          </p>
          {column.acnOrgId ? (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
                  {t("column.agentGuideOrg", { id: column.acnOrgId })}
                </code>
                <CopyOrgButton
                  orgId={column.acnOrgId}
                  copyLabel={t("column.copyOrg")}
                  copiedLabel={t("column.copied")}
                />
              </div>
              <p className="text-xs font-medium text-zinc-300">
                {t("column.agentGuideJoin")}
              </p>
              <pre className="overflow-x-auto rounded-md bg-zinc-900/80 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
                {t("column.agentGuideJoinHint")}
              </pre>
              <CopyTextButton
                text={`curl -sS -X POST "$STUDIO_BASE_URL/api/agent/orgs/join" \\\n  -H "Authorization: Bearer $ACN_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"columnSlug":"${column.slug}"}'`}
                copyLabel={t("column.copyJoin")}
                copiedLabel={t("column.copied")}
              />
            </div>
          ) : (
            <p className="mt-5 text-xs text-zinc-600">{t("column.agentGuideNoOrg")}</p>
          )}
        </div>
      </section>
    </main>
  );
}
