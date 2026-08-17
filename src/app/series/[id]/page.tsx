import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { translate, translateCategory } from "@/lib/i18n";
import Link from "next/link";
import WorkWatch from "@/components/WorkWatch";
import { authorLine, authorLinksForWorks } from "@/lib/profile";
import { toAppearanceCredits } from "@/lib/workAppearance";

export const dynamic = "force-dynamic";

export default async function WorkPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ep?: string }>;
}) {
  const locale = await getLocale();
  const { id } = await props.params;
  const { ep } = await props.searchParams;

  const work = await prisma.work.findUnique({
    where: { id },
    include: {
      appearances: true,
      episodes: {
        orderBy: { order: "asc" },
        include: { sourceWork: { select: { id: true, appearances: true } } },
      },
    },
  });
  if (!work) notFound();
  const [author] = await authorLinksForWorks([work]);
  const castByWorkId: Record<string, ReturnType<typeof toAppearanceCredits>> = {
    [work.id]: toAppearanceCredits(work.appearances),
  };
  for (const episode of work.episodes) {
    if (episode.sourceWork) {
      castByWorkId[episode.sourceWork.id] = toAppearanceCredits(
        episode.sourceWork.appearances,
      );
    }
  }
  const creatorLine = authorLine({
    handle: author?.handle,
    authorName: work.authorName,
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-md bg-accent/10 px-2 py-0.5 font-medium text-accent">
          {work.kind === "SERIES"
            ? work.category
              ? translateCategory(locale, work.category)
              : translate(locale, "common.series")
            : translate(locale, "common.video")}
        </span>
        <span>
          {translate(locale, "series.publishedAt", {
            date: fmtDate(work.publishedAt.toISOString(), locale),
          })}
        </span>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-zinc-50">{work.title}</h1>
      {creatorLine && (
        <p className="mt-1 text-sm text-zinc-500">
          {author?.href ? (
            <Link href={author.href} className="hover:text-accent">
              {translate(locale, "series.creator", { name: creatorLine })}
            </Link>
          ) : (
            translate(locale, "series.creator", { name: creatorLine })
          )}
        </p>
      )}
      {work.description && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          {work.description}
        </p>
      )}

      <div className="mt-6">
        <WorkWatch
          workId={work.id}
          title={work.title}
          videoUrl={work.videoUrl}
          coverUrl={work.coverUrl}
          episodes={work.episodes}
          initialEpisodeId={ep}
          castByWorkId={castByWorkId}
        />
      </div>
    </div>
  );
}
