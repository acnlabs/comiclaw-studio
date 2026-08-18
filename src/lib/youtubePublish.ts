import { prisma } from "@/lib/db";
import { PublishError } from "@/lib/publish";
import { ownerFromRecord } from "@/lib/owner";
import {
  decryptSecret,
  encryptSecret,
  youtubeConfigured,
  youtubeSecrets,
} from "@/lib/youtubeCrypto";
import {
  exchangeYoutubeCode,
  fetchYoutubeChannel,
  refreshYoutubeAccessToken,
  uploadYoutubeVideo,
  type YoutubePrivacy,
} from "@/lib/youtubeApi";
import { studioPublicOrigin } from "@/lib/creditNotifyText";

export const YOUTUBE_PLATFORM = "YouTube";
export const YOUTUBE_OWNER_TYPE = "user";
export const MAX_YOUTUBE_BYTES = 200 * 1024 * 1024;

export const YOUTUBE_PUBLISH_ERRORS = {
  not_configured: "YouTube publishing is not configured on this server",
  not_user_owned:
    "Only a user-owned project can publish to YouTube. Claim the project first",
  not_connected: "Project owner has not connected YouTube",
  no_film: "Add a final film before publishing",
  video_too_large: "Film is larger than 200MB; compress it before publishing",
  video_unreadable: "Could not download the film to upload it",
} as const;

export type YoutubePublishReason = keyof typeof YOUTUBE_PUBLISH_ERRORS;

export type YoutubeListing = {
  title: string;
  description?: string | null;
  tags?: string[] | null;
  privacy?: YoutubePrivacy;
};

export type YoutubeAccountPublic = {
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
};

export function resolveYoutubeAccountOwner(project: {
  ownerKind?: string | null;
  ownerUserId: string | null;
}): { ok: true; ownerUserId: string } | { ok: false; reason: "not_user_owned" } {
  const owner = ownerFromRecord(project);
  if (owner.ownerKind !== "user" || !owner.ownerUserId) {
    return { ok: false, reason: "not_user_owned" };
  }
  return { ok: true, ownerUserId: owner.ownerUserId };
}

export function checkYoutubePublishable(args: {
  configured: boolean;
  ownerUserId: string | null;
  connected: boolean;
  hasFilm: boolean;
}): { ok: true } | { ok: false; reason: YoutubePublishReason } {
  if (!args.configured) return { ok: false, reason: "not_configured" };
  if (!args.ownerUserId) return { ok: false, reason: "not_user_owned" };
  if (!args.hasFilm) return { ok: false, reason: "no_film" };
  if (!args.connected) return { ok: false, reason: "not_connected" };
  return { ok: true };
}

export function buildYoutubeSnippet(args: {
  title: string;
  description?: string | null;
  tags?: string[] | null;
  durationSec?: number | null;
}): { title: string; description: string; tags: string[] } {
  const title = args.title.trim().slice(0, 100) || "Untitled";
  const lines: string[] = [];
  const desc = args.description?.trim();
  if (desc) lines.push(desc.slice(0, 4500));
  const duration = args.durationSec ?? 0;
  if (duration > 0 && duration <= 180 && !/\b#shorts\b/i.test(lines.join("\n"))) {
    lines.push("#Shorts");
  }
  if (!/AI-generated/i.test(lines.join("\n"))) {
    lines.push("This video includes AI-generated imagery.");
  }
  const tags = (args.tags ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
  return { title, description: lines.join("\n\n").slice(0, 5000), tags };
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export type YoutubeOwnerAction = {
  kind: "connect" | "claim";
  url: string;
};

/** Link comiclaw can send the human. Google consent still has to be clicked by them. */
export function youtubeOwnerAction(args: {
  shareToken: string;
  hasOwnerUser: boolean;
  connected: boolean;
  origin?: string;
}): YoutubeOwnerAction | null {
  const token = args.shareToken.trim();
  if (!token) return null;
  const origin = (args.origin ?? studioPublicOrigin()).replace(/\/+$/, "");
  const projectUrl = `${origin}/p/${encodeURIComponent(token)}`;
  if (!args.hasOwnerUser) {
    return { kind: "claim", url: projectUrl };
  }
  if (!args.connected) {
    return { kind: "connect", url: `${projectUrl}?youtube=connect` };
  }
  return null;
}

async function findYoutubeAccount(ownerUserId: string) {
  return prisma.externalAccount.findUnique({
    where: {
      ownerType_ownerId_platform: {
        ownerType: YOUTUBE_OWNER_TYPE,
        ownerId: ownerUserId,
        platform: "youtube",
      },
    },
  });
}

export async function getYoutubeAccountPublic(
  ownerUserId: string,
): Promise<YoutubeAccountPublic> {
  const row = await findYoutubeAccount(ownerUserId);
  if (!row) {
    return { connected: false, channelId: null, channelTitle: null };
  }
  return {
    connected: true,
    channelId: row.channelId,
    channelTitle: row.channelTitle,
  };
}

export async function getYoutubePublishSnapshot(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      filmVersions: { orderBy: { createdAt: "desc" }, take: 1 },
      releases: {
        where: { platform: YOUTUBE_PLATFORM },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!project) return null;

  const owner = resolveYoutubeAccountOwner(project);
  const ownerUserId = owner.ok ? owner.ownerUserId : null;
  const account = ownerUserId
    ? await getYoutubeAccountPublic(ownerUserId)
    : { connected: false, channelId: null, channelTitle: null };
  const film = project.filmVersions[0] ?? null;
  const release = project.releases[0] ?? null;
  const configured = youtubeConfigured();
  const check = checkYoutubePublishable({
    configured,
    ownerUserId,
    connected: account.connected,
    hasFilm: Boolean(film),
  });

  return {
    configured,
    hasFilm: Boolean(film),
    hasOwnerUser: Boolean(ownerUserId),
    ownerUserId,
    connected: account.connected,
    channelId: account.channelId,
    channelTitle: account.channelTitle,
    canPublish: check.ok,
    blockedReason: check.ok ? null : check.reason,
    ownerAction: youtubeOwnerAction({
      shareToken: project.shareToken,
      hasOwnerUser: Boolean(ownerUserId),
      connected: account.connected,
    }),
    defaults: {
      title: project.name,
      description: project.description ?? "",
    },
    release: release
      ? {
          id: release.id,
          url: release.url,
          status: release.status,
          publishedAt: release.publishedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function saveYoutubeAccountFromCode(args: {
  ownerUserId: string;
  code: string;
}) {
  const secrets = youtubeSecrets();
  if (!secrets) throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS.not_configured);

  const tokens = await exchangeYoutubeCode({
    code: args.code,
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    redirectUri: secrets.redirectUri,
  });
  if (!tokens.refreshToken) {
    throw new PublishError(
      400,
      "Google did not return a refresh token. Disconnect the app in Google Account permissions and connect again",
    );
  }
  const channel = await fetchYoutubeChannel(tokens.accessToken);
  const data = {
    ownerType: YOUTUBE_OWNER_TYPE,
    ownerId: args.ownerUserId,
    platform: "youtube",
    channelId: channel.channelId,
    channelTitle: channel.channelTitle,
    refreshToken: encryptSecret(tokens.refreshToken, secrets.tokenSecret),
    accessToken: encryptSecret(tokens.accessToken, secrets.tokenSecret),
    accessExpiresAt: new Date(tokens.expiresAt),
    scopes: tokens.scope ?? null,
  };
  return prisma.externalAccount.upsert({
    where: {
      ownerType_ownerId_platform: {
        ownerType: YOUTUBE_OWNER_TYPE,
        ownerId: args.ownerUserId,
        platform: "youtube",
      },
    },
    create: data,
    update: data,
  });
}

export async function disconnectYoutubeAccount(ownerUserId: string) {
  const row = await findYoutubeAccount(ownerUserId);
  if (!row) return false;
  await prisma.externalAccount.delete({ where: { id: row.id } });
  return true;
}

async function validAccessToken(ownerUserId: string): Promise<string> {
  const secrets = youtubeSecrets();
  if (!secrets) throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS.not_configured);
  const row = await findYoutubeAccount(ownerUserId);
  if (!row) throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS.not_connected);

  const refreshToken = decryptSecret(row.refreshToken, secrets.tokenSecret);
  const cached =
    row.accessToken && row.accessExpiresAt && row.accessExpiresAt.getTime() > Date.now() + 60_000
      ? decryptSecret(row.accessToken, secrets.tokenSecret)
      : null;
  if (cached) return cached;

  const next = await refreshYoutubeAccessToken({
    refreshToken,
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
  });
  await prisma.externalAccount.update({
    where: { id: row.id },
    data: {
      accessToken: encryptSecret(next.accessToken, secrets.tokenSecret),
      accessExpiresAt: new Date(next.expiresAt),
      refreshToken: next.refreshToken
        ? encryptSecret(next.refreshToken, secrets.tokenSecret)
        : undefined,
    },
  });
  return next.accessToken;
}

export async function publishProjectToYoutube(
  projectId: string,
  listing: YoutubeListing,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { filmVersions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!project) throw new PublishError(404, "Project not found");

  const owner = resolveYoutubeAccountOwner(project);
  const film = project.filmVersions[0] ?? null;
  const account = owner.ok
    ? await getYoutubeAccountPublic(owner.ownerUserId)
    : { connected: false, channelId: null, channelTitle: null };
  const check = checkYoutubePublishable({
    configured: youtubeConfigured(),
    ownerUserId: owner.ok ? owner.ownerUserId : null,
    connected: account.connected,
    hasFilm: Boolean(film),
  });
  if (!check.ok) {
    throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS[check.reason]);
  }
  if (!owner.ok || !film) {
    throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS.no_film);
  }

  const accessToken = await validAccessToken(owner.ownerUserId);
  const snippet = buildYoutubeSnippet({
    title: listing.title,
    description: listing.description,
    tags: listing.tags,
    durationSec: film.duration,
  });
  const video = await fetch(film.videoUrl);
  if (!video.ok) {
    throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS.video_unreadable);
  }
  const bytes = Buffer.from(await video.arrayBuffer());
  if (bytes.length > MAX_YOUTUBE_BYTES) {
    throw new PublishError(400, YOUTUBE_PUBLISH_ERRORS.video_too_large);
  }
  const contentType = video.headers.get("content-type") || "video/mp4";
  const uploaded = await uploadYoutubeVideo({
    accessToken,
    bytes,
    contentType,
    snippet,
    privacy: listing.privacy ?? "public",
  });

  const release = await prisma.release.create({
    data: {
      projectId,
      platform: YOUTUBE_PLATFORM,
      url: youtubeWatchUrl(uploaded.videoId),
      status: "PUBLISHED",
      publishedAt: new Date(),
      notes: `youtube:${uploaded.videoId}`,
    },
  });

  return {
    release,
    videoId: uploaded.videoId,
    url: release.url,
    channelTitle: account.channelTitle,
  };
}
