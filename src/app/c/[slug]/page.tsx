import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ColumnWorkspace from "@/components/ColumnWorkspace";
import { isCollabColumn } from "@/lib/columnIssue";

export const dynamic = "force-dynamic";

export default async function ColumnWorkspacePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const column = await prisma.column.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      ownerUserId: true,
      contributePolicy: true,
    },
  });
  if (!column) notFound();

  const collab = isCollabColumn(column.contributePolicy);
  const entries = collab
    ? await prisma.project.findMany({
        where: {
          columnId: column.id,
          parentProjectId: null,
          visibility: "PUBLIC",
        },
        orderBy: [{ entryOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          shareToken: true,
          entryOrder: true,
          currentStage: true,
          coverUrl: true,
          work: { select: { id: true } },
        },
      })
    : [];

  return (
    <ColumnWorkspace
      columnId={column.id}
      name={column.name}
      description={column.description}
      ownerUserId={column.ownerUserId}
      contributePolicy={column.contributePolicy}
      episodes={entries.map((ep) => ({
        id: ep.id,
        name: ep.name,
        shareToken: ep.shareToken,
        entryOrder: ep.entryOrder,
        currentStage: ep.currentStage,
        coverUrl: ep.coverUrl,
        workId: ep.work?.id ?? null,
      }))}
    />
  );
}
