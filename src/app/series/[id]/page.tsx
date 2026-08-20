import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { translate, translateCategory } from "@/lib/i18n";
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
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6 lg:px-8">
      <WorkWatch
        workId={work.id}
        title={work.title}
        kindLabel={
          work.kind === "SERIES"
            ? work.category
              ? translateCategory(locale, work.category)
              : translate(locale, "common.series")
            : translate(locale, "common.video")
        }
        publishedAt={translate(locale, "series.publishedAt", {
          date: fmtDate(work.publishedAt.toISOString(), locale),
        })}
        creatorLine={creatorLine}
        creatorHref={author?.href ?? null}
        description={work.description}
        videoUrl={work.videoUrl}
        coverUrl={work.coverUrl}
        episodes={work.episodes}
        initialEpisodeId={ep}
        creditsByWorkId={creditsByWorkId}
        category={work.category}
      />
    </div>
  );
}
