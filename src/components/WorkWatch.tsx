"use client";

import Link from "next/link";
import { useState } from "react";
import WorkPlayer from "@/components/WorkPlayer";
import WorkCastList from "@/components/WorkCastList";
import WorkDiscussion from "@/components/WorkDiscussion";
import { fmtDuration } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";
import type { CreditRow } from "@/lib/workCredit";

type EpisodeData = {
  id: string;
  order: number;
  title: string | null;
  videoUrl: string;
  duration: number | null;
  sourceWorkId?: string | null;
};

export default function WorkWatch({
  workId,
  title,
  kindLabel,
  publishedAt,
  creatorLine,
  creatorHref,
  description,
  videoUrl,
  coverUrl,
  episodes,
  initialEpisodeId,
  creditsByWorkId,
}: {
  workId: string;
  title: string;
  kindLabel: string;
  publishedAt: string;
  creatorLine: string | null;
  creatorHref: string | null;
  description: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  episodes: EpisodeData[];
  initialEpisodeId?: string | null;
  creditsByWorkId?: Record<string, CreditRow[]>;
}) {
  const { t } = useT();
  const [current, setCurrent] = useState<EpisodeData | null>(
    (initialEpisodeId && episodes.find((e) => e.id === initialEpisodeId)) ||
      episodes[0] ||
      null,
  );
  const videoId = current?.sourceWorkId ?? current?.id ?? workId;
  const playingUrl = current?.videoUrl ?? videoUrl;
  const seedTitle = current?.title ? `${title} · ${current.title}` : title;

  function select(episode: EpisodeData) {
    setCurrent(episode);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("ep", episode.id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
        <WorkPlayer videoUrl={playingUrl} coverUrl={coverUrl} />

        <aside className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded-md bg-accent/10 px-2 py-0.5 font-medium text-accent">
                {kindLabel}
              </span>
              <span>{publishedAt}</span>
              {episodes.length > 0 ? (
                <span>{t("common.episodes", { n: episodes.length })}</span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-zinc-50">{title}</h1>
            {creatorLine ? (
              <p className="mt-1 text-sm text-zinc-500">
                {creatorHref ? (
                  <Link href={creatorHref} className="hover:text-accent">
                    {t("series.creator", { name: creatorLine })}
                  </Link>
                ) : (
                  t("series.creator", { name: creatorLine })
                )}
              </p>
            ) : null}
            {current?.title ? (
              <p className="mt-1 text-sm text-zinc-400">
                {t("series.episodeItem", {
                  n: current.order,
                  title: current.title,
                })}
              </p>
            ) : null}
            {description ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>

          {episodes.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-zinc-400">
                {t("series.episodeList", { n: episodes.length })}
              </h2>
              <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {episodes.map((episode) => (
                  <button
                    key={episode.id}
                    type="button"
                    onClick={() => select(episode)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      current?.id === episode.id
                        ? "bg-accent font-medium text-zinc-950"
                        : "bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {episode.order}
                      {episode.title ? ` · ${episode.title}` : ""}
                    </span>
                    {episode.duration != null ? (
                      <span
                        className={`shrink-0 text-[10px] ${
                          current?.id === episode.id ? "text-zinc-800" : "text-zinc-500"
                        }`}
                      >
                        {fmtDuration(episode.duration)}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <WorkCastList
            credits={creditsByWorkId?.[videoId] ?? creditsByWorkId?.[workId] ?? []}
          />
        </aside>
      </div>

      <WorkDiscussion
        workId={workId}
        videoId={videoId}
        episodeId={current?.id}
        title={seedTitle}
      />
    </div>
  );
}
