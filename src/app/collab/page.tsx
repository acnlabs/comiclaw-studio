import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import CollabProjectCard from "@/components/collab/CollabProjectCard";

export const dynamic = "force-dynamic";

export default async function CollabIndexPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate(locale, key, params);

  // 官方「记」留在发现/专栏里;这里只列可加入的公开项目
  const projects = await prisma.project.findMany({
    where: {
      visibility: "PUBLIC",
      NOT: {
        AND: [{ columnId: { not: null } }, { parentProjectId: null }],
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      name: true,
      description: true,
      coverUrl: true,
      shareToken: true,
      agentName: true,
      clientName: true,
      parentProject: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{t("collabIndex.title")}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t("collabIndex.subtitle")}</p>

      {projects.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {t("collabIndex.empty")}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <CollabProjectCard
              key={p.id}
              project={{
                shareToken: p.shareToken,
                name: p.name,
                description: p.description,
                coverUrl: p.coverUrl,
                by: p.agentName ?? p.clientName,
              }}
              respondsToLabel={
                p.parentProject
                  ? t("collabIndex.respondsTo", { entry: p.parentProject.name })
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
