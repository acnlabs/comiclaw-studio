import Link from "next/link";
import { safeMediaUrl } from "@/lib/columnTimeline";

export type ColumnCardData = {
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  entryCount: number;
  /** Newest public entry, used as the card's teaser line */
  latestEntry: string | null;
};

/**
 * Columns rarely have artwork early on, so the fallback cover sets the name as
 * a masthead over a deterministic tint instead of leaving a dark empty box.
 */
const TINTS = [
  "from-amber-500/40 via-amber-900/20 to-zinc-950",
  "from-sky-500/40 via-sky-900/20 to-zinc-950",
  "from-violet-500/40 via-violet-900/20 to-zinc-950",
  "from-emerald-500/40 via-emerald-900/20 to-zinc-950",
  "from-rose-500/40 via-rose-900/20 to-zinc-950",
];

function tintFor(slug: string): string {
  let sum = 0;
  for (let i = 0; i < slug.length; i++) sum = (sum + slug.charCodeAt(i)) % 997;
  return TINTS[sum % TINTS.length];
}

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
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br px-6 ${tintFor(column.slug)}`}
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
