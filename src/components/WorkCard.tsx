"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";

export interface WorkCardData {
  id: string;
  kind: string;
  category: string | null;
  title: string;
  coverUrl: string | null;
  authorName: string | null;
  publishedAt: string;
  episodeCount?: number;
}

export default function WorkCard({ work }: { work: WorkCardData }) {
  const { t, tCategory, fmtDate } = useT();

  return (
    <Link
      href={`/series/${work.id}`}
      className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600"
    >
      <div className="relative aspect-[3/4] bg-zinc-950">
        {work.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.coverUrl}
            alt={work.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">🎬</div>
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-accent">
            {work.kind === "SERIES"
              ? work.category
                ? tCategory(work.category)
                : t("common.series")
              : t("common.video")}
          </span>
        </div>
        {work.kind === "SERIES" && work.episodeCount != null && (
          <span className="absolute bottom-2 right-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs text-zinc-300">
            {t("common.episodes", { n: work.episodeCount })}
          </span>
        )}
      </div>
      <div className="px-3.5 py-3">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-100">{work.title}</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {work.authorName && <>{work.authorName} · </>}
          {fmtDate(work.publishedAt)}
        </p>
      </div>
    </Link>
  );
}
