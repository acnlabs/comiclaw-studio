import { prisma } from "@/lib/db";

export async function nextScriptVersion(
  projectId: string,
  authorKey: string
): Promise<number> {
  const latest = await prisma.scriptVersion.findFirst({
    where: { projectId, authorKey },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function nextFilmVersion(
  projectId: string,
  authorKey: string
): Promise<number> {
  const latest = await prisma.filmVersion.findFirst({
    where: { projectId, authorKey },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export async function nextShotOrder(
  projectId: string,
  authorKey: string
): Promise<number> {
  const latest = await prisma.shot.findFirst({
    where: { projectId, authorKey },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (latest?.order ?? 0) + 1;
}
