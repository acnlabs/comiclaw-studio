import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DISCOVER_COLUMN_CAT } from "@/lib/discover";

export const dynamic = "force-dynamic";

export default async function ColumnPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const column = await prisma.column.findUnique({
    where: { slug },
    select: { seriesWork: { select: { id: true } } },
  });
  if (!column) notFound();
  if (column.seriesWork) redirect(`/series/${column.seriesWork.id}`);
  redirect(`/series?cat=${encodeURIComponent(DISCOVER_COLUMN_CAT)}`);
}
