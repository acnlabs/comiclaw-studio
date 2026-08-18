import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { translate, translateCategory } from "@/lib/i18n";
import Link from "next/link";
import WorkWatch from "@/components/WorkWatch";
import { liveAgentNames } from "@/lib/agentplanet";
import { applyLiveCreditNames, authorLine } from "@/lib/authorLine";
import { authorLinksForWorks } from "@/lib/profile";
import { listedCredits } from "@/lib/workCredit";

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
      credits: true,
      episodes: {
        orderBy: { order: "asc" },
        include: {
          sourceWork: {
            select: {
              id: true,
              ownerKind: true,
              ownerAgentId: true,
              appearances: true,
              credits: true,
            },
          },
        },
      },
    },
  });
  if (!work) notFound();
  const [author] = await authorLinksForWorks([work]);
  const rawCredits: Record<string, ReturnType<typeof listedCredits>> = {
    [work.id]: listedCredits(work),
  };
  for (const episode of work.episodes) {
    if (episode.sourceWork) {
      rawCredits[episode.sourceWork.id] = listedCredits(episode.sourceWork);
    }
  }
  const live = await liveAgentNames(
    Object.values(rawCredits).flatMap((rows) => rows.map((row) => row.agentId)),
  );
  const creditsByWorkId = Object.fromEntries(
    Object.entries(rawCredits).map(([id, rows]) => [
      id,
      applyLiveCreditNames(rows, live),
    ]),
  );
  const creatorLine = authorLine({
    handle: author?.handle,
    authorName: author?.displayName ?? work.authorName,
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
          creditsByWorkId={creditsByWorkId}
        />
      </div>
    </div>
  );
}
