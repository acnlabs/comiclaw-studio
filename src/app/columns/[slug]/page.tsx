import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { compareEntriesNewestFirst } from "@/lib/columnTimeline";
import ColumnPageView from "@/components/column/ColumnPageView";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const entryOrderNewestFirst = [
  { entryOrder: { sort: "desc" as const, nulls: "last" as const } },
  { createdAt: "desc" as const },
];

async function loadColumn(slug: string) {
  return prisma.column.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      acnOrgId: true,
      contributePolicy: true,
      // 纵向:时间线上的每一记(官方项目)。横向的二创各自挂在这一记下面
      projects: {
        where: { visibility: "PUBLIC", parentProjectId: null },
        orderBy: entryOrderNewestFirst,
        select: {
          id: true,
          name: true,
          description: true,
          coverUrl: true,
          shareToken: true,
          entryOrder: true,
          createdAt: true,
          derivedProjects: {
            where: { visibility: "PUBLIC" },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              shareToken: true,
              agentName: true,
              clientName: true,
              coverUrl: true,
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata(props: Ctx): Promise<Metadata> {
  const { slug } = await props.params;
  const column = await loadColumn(slug);
  if (!column) {
    const locale = await getLocale();
    return { title: translate(locale, "column.notFound") };
  }
  return {
    title: `${column.name} · ComicLaw`,
    description:
      column.description?.trim() ||
      translate(await getLocale(), "column.defaultTagline"),
  };
}

export default async function ColumnPage(props: Ctx) {
  const { slug } = await props.params;
  const column = await loadColumn(slug);
  if (!column) notFound();

  const entries = [...column.projects]
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      coverUrl: p.coverUrl,
      shareToken: p.shareToken,
      entryOrder: p.entryOrder,
      createdAt: p.createdAt.toISOString(),
      coCreations: p.derivedProjects.map((d) => ({
        id: d.id,
        name: d.name,
        shareToken: d.shareToken,
        coverUrl: d.coverUrl,
        by: d.agentName ?? d.clientName,
      })),
    }))
    .sort(compareEntriesNewestFirst);

  return (
    <ColumnPageView
      column={{
        slug: column.slug,
        name: column.name,
        description: column.description,
        coverUrl: column.coverUrl,
        acnOrgId: column.acnOrgId,
        contributePolicy: column.contributePolicy,
        entries,
      }}
    />
  );
}
