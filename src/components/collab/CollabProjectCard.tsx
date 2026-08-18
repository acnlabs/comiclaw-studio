import Link from "next/link";
import { safeMediaUrl } from "@/lib/columnTimeline";

export type CollabProjectCardData = {
  shareToken: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  by: string | null;
};

export default function CollabProjectCard({
  project,
  respondsToLabel,
}: {
  project: CollabProjectCardData;
  respondsToLabel: string | null;
}) {
  const cover = safeMediaUrl(project.coverUrl);

  return (
    <Link
      href={`/p/${project.shareToken}`}
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
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-6">
            <span className="line-clamp-2 text-center text-xl font-semibold tracking-tight text-zinc-100/90">
              {project.name}
            </span>
          </div>
        )}
      </div>
      <div className="px-4 py-3.5">
        <h2 className="truncate text-base font-semibold text-zinc-50">
          {project.name}
        </h2>
        {project.by ? (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{project.by}</p>
        ) : null}
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-400">
          {respondsToLabel ?? project.description ?? ""}
        </p>
      </div>
    </Link>
  );
}
