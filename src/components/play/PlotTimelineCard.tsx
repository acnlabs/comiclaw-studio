import Link from "next/link";
import { mastheadTint } from "@/lib/mastheadTint";

export type PlotTimelineItem = {
  id: string;
  name: string;
  coverUrl: string | null;
  x: number;
  y: number;
  published: boolean;
};

export default function PlotTimelineCard({
  plot,
  coordLabel,
  statusLabel,
  enterLabel,
}: {
  plot: PlotTimelineItem;
  coordLabel: string;
  statusLabel: string;
  enterLabel: string;
}) {
  const title = plot.name.trim() || coordLabel;
  return (
    <article className="group w-40 shrink-0 sm:w-44">
      <Link
        href={`/play/plot/${plot.id}`}
        className="block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600"
      >
        <div className="relative aspect-[2/3] bg-zinc-950">
          {plot.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plot.coverUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br px-3 ${mastheadTint(plot.id + title)}`}
            >
              <span className="line-clamp-4 text-center text-sm font-semibold text-zinc-100/90">
                {title}
              </span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-zinc-950/80 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
            {coordLabel}
          </span>
          {!plot.published ? (
            <span className="absolute right-2 top-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] text-zinc-400">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <div className="px-3 py-2.5">
          <h3 className="line-clamp-2 text-sm font-medium text-zinc-100 group-hover:text-accent">
            {title}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{enterLabel}</p>
        </div>
      </Link>
    </article>
  );
}
