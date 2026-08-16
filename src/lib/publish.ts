import { prisma } from "@/lib/db";
import { COLUMN_SERIES_CATEGORY } from "@/lib/discover";
import type { ComiclawPublishSnapshot, SeriesOption } from "@/lib/types";
import {
  ownerEqualsWhere,
  ownerFields,
  ownerFromRecord,
  ownersMatch,
  type ProjectOwner,
} from "@/lib/owner";
import {
  findAppearingAgentId,
  registerPublishedVideo,
  type VideoRegistryResult,
} from "@/lib/videoRegistry";
import { acceptedBoundAgentId } from "@/lib/videoRegistryRules";

export type ComiclawListing = {
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  authorName?: string | null;
  mode: "video" | "episode";
  episodeOrder?: number;
  episodeTitle?: string | null;
  seriesWorkId?: string | null;
  seriesTitle?: string | null;
  seriesDescription?: string | null;
  seriesCoverUrl?: string | null;
  /** Agent this film is about; Launch lists video assets bound to this id. */
  boundAgentId?: string | null;
};

type ListingOverrides = Partial<
  Pick<ComiclawListing, "title" | "description" | "coverUrl" | "authorName">
>;

// 项目发行上架后,把最新成片同步发布为平台作品(出现在「推荐」流)。
// 幂等:同一项目只对应一个作品,重复调用时更新。
export async function syncProjectToWork(
  projectId: string,
  listing?: ListingOverrides,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    // Prefer newest upload by time — version is per-author, not global
    include: { filmVersions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!project) return null;

  const film = project.filmVersions[0];
  if (!film) return null; // 没有成片,无内容可发布

  const owner = ownerFromRecord(project);
  const data = {
    kind: "VIDEO",
    title: listing?.title?.trim() || project.name,
    description:
      listing?.description === undefined
        ? project.description
        : listing.description,
    coverUrl:
      listing?.coverUrl === undefined ? project.coverUrl : listing.coverUrl,
    videoUrl: film.videoUrl,
    authorName:
      listing?.authorName === undefined
        ? (project.clientName ?? project.agentName)
        : listing.authorName,
    ...ownerFields(owner),
  };

  return prisma.work.upsert({
    where: { projectId },
    update: data,
    create: { ...data, projectId },
  });
}

export class PublishError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function upsertSeriesEpisode(args: {
  seriesId: string;
  order: number;
  title: string | null;
  videoUrl: string;
  duration: number | null;
  sourceWorkId: string;
}) {
  const bySource = await prisma.episode.findFirst({
    where: { workId: args.seriesId, sourceWorkId: args.sourceWorkId },
  });
  const data = {
    order: args.order,
    title: args.title,
    videoUrl: args.videoUrl,
    duration: args.duration,
    sourceWorkId: args.sourceWorkId,
  };
  if (bySource) {
    return prisma.episode.update({ where: { id: bySource.id }, data });
  }
  const byOrder = await prisma.episode.findFirst({
    where: { workId: args.seriesId, order: args.order },
  });
  if (byOrder) {
    if (byOrder.sourceWorkId && byOrder.sourceWorkId !== args.sourceWorkId) {
      throw new PublishError(409, "This episode number is already taken");
    }
    return prisma.episode.update({
      where: { id: byOrder.id },
      data: { ...data, sourceWorkId: args.sourceWorkId },
    });
  }
  return prisma.episode.create({
    data: { workId: args.seriesId, ...data },
  });
}

async function assertSeriesUsable(
  seriesId: string,
  project: {
    id: string;
    ownerKind?: string | null;
    ownerUserId: string | null;
    ownerAgentId?: string | null;
    ownerOrgId?: string | null;
    seriesWorkId: string | null;
    columnId: string | null;
  },
) {
  const owner = ownerFromRecord(project);
  const series = await prisma.work.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      kind: true,
      columnId: true,
      ownerKind: true,
      ownerUserId: true,
      ownerAgentId: true,
      ownerOrgId: true,
      column: { select: { ownerUserId: true } },
    },
  });
  if (!series || series.kind !== "SERIES") {
    throw new PublishError(404, "Series not found");
  }
  if (project.seriesWorkId === series.id) return series;
  if (project.columnId && series.columnId === project.columnId) return series;
  if (ownersMatch(owner, ownerFromRecord(series))) return series;
  if (owner.ownerKind === "user" && owner.ownerUserId && series.column?.ownerUserId === owner.ownerUserId) {
    return series;
  }
  const sameOwner = ownerEqualsWhere(owner);
  if (sameOwner) {
    const alreadyOnSeries = await prisma.project.findFirst({
      where: { seriesWorkId: series.id, ...sameOwner },
      select: { id: true },
    });
    if (alreadyOnSeries) return series;
  }
  throw new PublishError(403, "You cannot publish into this series");
}

async function registerListedVideo(args: {
  projectId: string;
  workId: string;
  displayName: string;
  filmAuthorAgentId: string | null;
  projectOwnerUserId: string | null;
  listing: ComiclawListing;
  publisherAgentId?: string | null;
  allowExplicitBoundAgent?: boolean;
}): Promise<VideoRegistryResult> {
  const inferred = await findAppearingAgentId({
    projectId: args.projectId,
    workId: args.workId,
  });
  const appearingAgentId = acceptedBoundAgentId({
    requested: args.listing.boundAgentId ?? null,
    inferred,
    publisherAgentId: args.publisherAgentId,
    filmAuthorAgentId: args.filmAuthorAgentId,
    allowExplicitBoundAgent: args.allowExplicitBoundAgent,
  });
  return registerPublishedVideo({
    workId: args.workId,
    displayName: args.displayName,
    appearingAgentId,
    publisherAgentId: args.publisherAgentId,
    filmAuthorAgentId: args.filmAuthorAgentId,
    projectOwnerUserId: args.projectOwnerUserId,
  });
}

/** 带上架信息发布到 ComicLaw。短视频进推荐;选剧集则同时写入一部系列。 */
export async function publishProjectToComiclaw(
  projectId: string,
  listing: ComiclawListing,
  opts?: { publisherAgentId?: string | null; allowExplicitBoundAgent?: boolean },
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      filmVersions: { orderBy: { createdAt: "desc" }, take: 1 },
      column: { select: { id: true, seriesWork: { select: { id: true } } } },
    },
  });
  if (!project) throw new PublishError(404, "Project not found");
  const film = project.filmVersions[0];
  if (!film) throw new PublishError(400, "Add a final film before publishing");

  const video = await syncProjectToWork(projectId, listing);
  if (!video) throw new PublishError(400, "Add a final film before publishing");

  const videoRegistry = await registerListedVideo({
    projectId,
    workId: video.id,
    displayName: listing.title.trim() || video.title,
    filmAuthorAgentId: film.authorAgentId,
    projectOwnerUserId: project.ownerUserId,
    listing,
    publisherAgentId: opts?.publisherAgentId,
    allowExplicitBoundAgent: opts?.allowExplicitBoundAgent,
  });
  if (videoRegistry.status !== "skipped" && videoRegistry.boundAgentId) {
    await prisma.work.update({
      where: { id: video.id },
      data: { appearingAgentId: videoRegistry.boundAgentId },
    });
  }

  if (listing.mode !== "episode") {
    if (project.columnId) {
      await syncColumnToSeries(project.columnId);
    }
    return { video, series: null as null, videoRegistry };
  }

  const order =
    listing.episodeOrder ??
    project.entryOrder ??
    1;
  if (order < 1) throw new PublishError(400, "episodeOrder must be at least 1");

  const requestedSeriesId =
    listing.seriesWorkId === undefined
      ? undefined
      : listing.seriesWorkId?.trim() || null;
  let seriesId =
    requestedSeriesId !== undefined
      ? requestedSeriesId
      : (project.seriesWorkId ?? project.column?.seriesWork?.id ?? null);

  if (project.columnId) {
    const columnSeries = await syncColumnToSeries(project.columnId);
    seriesId = columnSeries?.id ?? seriesId;
  } else if (seriesId) {
    await assertSeriesUsable(seriesId, project);
  } else {
    const seriesTitle = listing.seriesTitle?.trim();
    if (!seriesTitle) {
      throw new PublishError(400, "Series title is required for a new series");
    }
    const created = await prisma.work.create({
      data: {
        kind: "SERIES",
        category: "漫剧",
        title: seriesTitle,
        description: listing.seriesDescription ?? null,
        coverUrl: listing.seriesCoverUrl ?? listing.coverUrl ?? project.coverUrl,
        authorName: listing.authorName ?? project.clientName ?? project.agentName,
        videoUrl: null,
        ...ownerFields(ownerFromRecord(project)),
      },
    });
    seriesId = created.id;
  }

  if (!seriesId) throw new PublishError(400, "Series is required");

  const seriesPatch = {
    ...(listing.seriesTitle?.trim()
      ? { title: listing.seriesTitle.trim() }
      : {}),
    ...(listing.seriesDescription !== undefined
      ? { description: listing.seriesDescription }
      : {}),
    ...(listing.seriesCoverUrl !== undefined
      ? { coverUrl: listing.seriesCoverUrl }
      : {}),
  };
  if (Object.keys(seriesPatch).length > 0) {
    await prisma.work.update({ where: { id: seriesId }, data: seriesPatch });
  }

  if (!project.columnId) {
    await upsertSeriesEpisode({
      seriesId,
      order,
      title: listing.episodeTitle?.trim() || listing.title,
      videoUrl: film.videoUrl,
      duration: film.duration,
      sourceWorkId: video.id,
    });
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { seriesWorkId: seriesId },
  });

  const series = await prisma.work.findUnique({ where: { id: seriesId } });
  return { video, series, videoRegistry };
}

export async function listSeriesForPublisher(owner: ProjectOwner) {
  const sameOwner = ownerEqualsWhere(owner);
  if (!sameOwner) return [] as SeriesOption[];
  return prisma.work.findMany({
    where: {
      kind: "SERIES",
      OR: [
        sameOwner,
        ...(owner.ownerKind === "user" && owner.ownerUserId
          ? [{ column: { ownerUserId: owner.ownerUserId } }]
          : []),
        { episodeProjects: { some: sameOwner } },
      ],
    },
    select: { id: true, title: true, description: true, coverUrl: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
}

export async function getComiclawPublishSnapshot(
  projectId: string,
): Promise<ComiclawPublishSnapshot | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      filmVersions: { orderBy: { createdAt: "desc" }, take: 1 },
      work: true,
      seriesWork: true,
      column: { select: { name: true, seriesWork: true } },
    },
  });
  if (!project) return null;

  const video = project.work;
  const series = project.seriesWork ?? project.column?.seriesWork ?? null;
  const mode: "video" | "episode" = series ? "episode" : "video";

  let episodeOrder = project.entryOrder ?? 1;
  let episodeTitle = "";
  if (series && video) {
    const ep = await prisma.episode.findFirst({
      where: { workId: series.id, sourceWorkId: video.id },
    });
    if (ep) {
      episodeOrder = ep.order;
      episodeTitle = ep.title ?? "";
    } else {
      const last = await prisma.episode.findFirst({
        where: { workId: series.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      episodeOrder = (last?.order ?? 0) + 1;
    }
  }

  const seriesOptions = await listSeriesForPublisher(ownerFromRecord(project));
  if (series && !seriesOptions.some((s) => s.id === series.id)) {
    seriesOptions.unshift({
      id: series.id,
      title: series.title,
      description: series.description,
      coverUrl: series.coverUrl,
    });
  }

  return {
    hasFilm: Boolean(project.filmVersions[0]),
    canChooseSeries: !project.columnId,
    video: video
      ? {
          id: video.id,
          title: video.title,
          description: video.description,
          coverUrl: video.coverUrl,
          authorName: video.authorName,
        }
      : null,
    series: series
      ? {
          id: series.id,
          title: series.title,
          description: series.description,
          coverUrl: series.coverUrl,
        }
      : null,
    defaults: {
      title: video?.title || project.name,
      description: video?.description ?? project.description ?? "",
      coverUrl: video?.coverUrl ?? project.coverUrl ?? "",
      authorName:
        video?.authorName ?? project.clientName ?? project.agentName ?? "",
      mode,
      episodeOrder,
      episodeTitle: episodeTitle || video?.title || project.name,
      seriesWorkId: series?.id ?? "",
      seriesTitle: series?.title ?? "",
      seriesDescription: series?.description ?? "",
      seriesCoverUrl: series?.coverUrl ?? "",
    },
    seriesOptions,
  };
}

export {
  COLUMN_SERIES_CATEGORY,
  DISCOVER_ALL_CAT,
  DISCOVER_CATEGORIES,
  DISCOVER_COLUMN_CAT,
  isDiscoverColumnCategory,
  storedCategoriesForDiscover,
} from "@/lib/discover";

// 把一个专栏已出片的各记聚成一个系列作品(出现在「发现」库的专栏分类)。
// 每记本身仍是独立作品照常进推荐流;这里只是把它们按记序合成选集。
// 幂等:同一专栏只对应一个系列作品,重复调用时重建选集。
export async function syncColumnToSeries(columnId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      projects: {
        // 只有一记的官方项目进选集;同一记下的二创各自是独立作品,
        // 否则一记会在系列里占好几集
        where: { visibility: "PUBLIC", parentProjectId: null },
        orderBy: [{ entryOrder: "asc" }, { createdAt: "asc" }],
        include: {
          filmVersions: { orderBy: { createdAt: "desc" }, take: 1 },
          work: true,
        },
      },
    },
  });
  if (!column) return null;

  const aired = column.projects.filter((p) => p.filmVersions[0]);

  // 没有任何一记出片就不该在短剧库里占位;曾经有过则要收回
  if (aired.length === 0) {
    await prisma.work.deleteMany({ where: { columnId } });
    return null;
  }

  const data = {
    kind: "SERIES",
    category: COLUMN_SERIES_CATEGORY,
    title: column.name,
    description: column.description,
    coverUrl: column.coverUrl ?? aired[0].coverUrl,
    // 系列的正片由选集承载,不设单片地址
    videoUrl: null,
    authorName: aired[0].agentName ?? aired[0].clientName,
    ...ownerFields(ownerFromRecord(aired[0])),
  };

  return prisma.$transaction(async (tx) => {
    const work = await tx.work.upsert({
      where: { columnId },
      update: data,
      create: { ...data, columnId },
    });

    // 记序可能有空档或被删,整体重建比逐集对齐更不容易出错
    await tx.episode.deleteMany({ where: { workId: work.id } });
    await tx.episode.createMany({
      data: aired.map((p, i) => ({
        workId: work.id,
        sourceWorkId: p.work?.id ?? null,
        order: i + 1,
        title: p.name,
        videoUrl: p.filmVersions[0].videoUrl,
        duration: p.filmVersions[0].duration,
      })),
    });

    return work;
  });
}
