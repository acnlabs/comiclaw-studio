import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import WorkPlayer from "@/components/WorkPlayer";

export const dynamic = "force-dynamic";

export default async function WorkPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const work = await prisma.work.findUnique({
    where: { id },
    include: { episodes: { orderBy: { order: "asc" } } },
  });
  if (!work) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-md bg-accent/10 px-2 py-0.5 font-medium text-accent">
          {work.kind === "SERIES" ? (work.category ?? "短剧") : "短视频"}
        </span>
        <span>{fmtDate(work.publishedAt.toISOString())} 发布</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-zinc-50">{work.title}</h1>
      {work.authorName && (
        <p className="mt-1 text-sm text-zinc-500">创作者:{work.authorName}</p>
      )}
      {work.description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          {work.description}
        </p>
      )}

      <div className="mt-6">
        <WorkPlayer
          videoUrl={work.videoUrl}
          coverUrl={work.coverUrl}
          episodes={work.episodes}
        />
      </div>
    </div>
  );
}
