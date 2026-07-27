import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import ColumnPageView from "@/components/column/ColumnPageView";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

async function loadColumn(slug: string) {
  return prisma.column.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      acnOrgId: true,
      projects: {
        where: { visibility: "PUBLIC" },
        orderBy: [{ entryOrder: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          description: true,
          coverUrl: true,
          shareToken: true,
          entryOrder: true,
          agentName: true,
          createdAt: true,
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

  return (
    <ColumnPageView
      column={{
        slug: column.slug,
        name: column.name,
        description: column.description,
        coverUrl: column.coverUrl,
        acnOrgId: column.acnOrgId,
        entries: column.projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          coverUrl: p.coverUrl,
          shareToken: p.shareToken,
          entryOrder: p.entryOrder,
          agentName: p.agentName,
          createdAt: p.createdAt.toISOString(),
        })),
      }}
    />
  );
}
