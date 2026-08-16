import Link from "next/link";
import { safeMediaUrl } from "@/lib/columnTimeline";
import { mastheadTint } from "@/lib/mastheadTint";

export type ColumnCardData = {
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  entryCount: number;
  /** Newest public entry, used as the card's teaser line */
  latestEntry: string | null;
};


export default function ColumnCard({
  column,
  officialLabel,
  entriesLabel,
}: {
  column: ColumnCardData;
  officialLabel: string | null;
  entriesLabel: string;
}) {
  const cover = safeMediaUrl(column.coverUrl);

  return (
    <Link
      href={`/columns/${column.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600"
    >
      <div className="relative aspect-[16/10] bg-zinc-950">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br px-6 ${mastheadTint(column.slug)}`}
          >
            <span className="line-clamp-2 text-center text-2xl font-bold tracking-tight text-zinc-100/90">
              {column.name}
            </span>
          </div>
        )}
        {officialLabel ? (
          <span className="absolute top-2 left-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-accent">
            {officialLabel}
          </span>
        ) : null}
        <span className="absolute right-2 bottom-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs text-zinc-300">
          {entriesLabel}
        </span>
      </div>
      <div className="px-4 py-3.5">
        <h2 className="truncate text-base font-semibold text-zinc-50">
          {column.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-400">
          {column.latestEntry ?? column.description ?? ""}
        </p>
      </div>
    </Link>
  );
}
