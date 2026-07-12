import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { ProjectData } from "@/lib/types";
import StudioWorkspace from "@/components/StudioWorkspace";
import LiveRefresh from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

export default async function ProjectPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    include: {
      scriptVersions: { orderBy: { version: "desc" } },
      assets: {
        orderBy: { createdAt: "asc" },
        include: { versions: { orderBy: { version: "desc" } } },
      },
      shots: {
        orderBy: { order: "asc" },
        include: {
          versions: { orderBy: { version: "desc" } },
          assetRefs: {
            include: { asset: { select: { id: true, name: true, type: true } } },
          },
        },
      },
      filmVersions: { orderBy: { version: "desc" } },
      releases: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) notFound();

  const data = JSON.parse(JSON.stringify(project)) as ProjectData;

  return (
    <>
      <LiveRefresh token={token} />
      <StudioWorkspace project={data} />
    </>
  );
}
