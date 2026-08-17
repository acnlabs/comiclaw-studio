import { PublishError } from "@/lib/publish";

export type YoutubePrivacy = "public" | "unlisted" | "private";

export type YoutubeTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope?: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export function youtubeAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: args.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function readGoogleError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text) as {
      error?: string | { message?: string };
      error_description?: string;
    };
    if (typeof json.error === "string") {
      return json.error_description || json.error;
    }
    if (json.error && typeof json.error === "object" && json.error.message) {
      return json.error.message;
    }
  } catch {
    /* use raw */
  }
  return text.slice(0, 300) || fallback;
}

function parseTokenJson(json: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}): YoutubeTokenSet {
  if (!json.access_token) {
    throw new PublishError(502, "Google did not return an access token");
  }
  const expiresIn = Number(json.expires_in) || 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: json.scope,
  };
}

export async function exchangeYoutubeCode(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<YoutubeTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new PublishError(502, `Google token exchange failed: ${await readGoogleError(res, res.statusText)}`);
  }
  return parseTokenJson((await res.json()) as Parameters<typeof parseTokenJson>[0]);
}

export async function refreshYoutubeAccessToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<YoutubeTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new PublishError(502, `Google token refresh failed: ${await readGoogleError(res, res.statusText)}`);
  }
  const parsed = parseTokenJson((await res.json()) as Parameters<typeof parseTokenJson>[0]);
  return { ...parsed, refreshToken: parsed.refreshToken ?? args.refreshToken };
}

export async function fetchYoutubeChannel(accessToken: string): Promise<{
  channelId: string | null;
  channelTitle: string | null;
}> {
  const url = `${CHANNELS_URL}?part=snippet&mine=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new PublishError(502, `YouTube channel lookup failed: ${await readGoogleError(res, res.statusText)}`);
  }
  const json = (await res.json()) as {
    items?: { id?: string; snippet?: { title?: string } }[];
  };
  const item = json.items?.[0];
  return {
    channelId: item?.id ?? null,
    channelTitle: item?.snippet?.title ?? null,
  };
}

export async function uploadYoutubeVideo(args: {
  accessToken: string;
  bytes: Buffer;
  contentType: string;
  snippet: { title: string; description: string; tags: string[] };
  privacy: YoutubePrivacy;
}): Promise<{ videoId: string }> {
  const init = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(args.bytes.length),
      "X-Upload-Content-Type": args.contentType,
    },
    body: JSON.stringify({
      snippet: {
        title: args.snippet.title,
        description: args.snippet.description,
        tags: args.snippet.tags,
        categoryId: "1",
      },
      status: {
        privacyStatus: args.privacy,
        selfDeclaredMadeForKids: false,
      },
    }),
  });
  if (!init.ok) {
    throw new PublishError(502, `YouTube upload init failed: ${await readGoogleError(init, init.statusText)}`);
  }
  const location = init.headers.get("location");
  if (!location) {
    throw new PublishError(502, "YouTube did not return an upload URL");
  }

  const put = await fetch(location, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": args.contentType,
      "Content-Length": String(args.bytes.length),
    },
    body: new Uint8Array(args.bytes),
  });
  if (!put.ok) {
    throw new PublishError(502, `YouTube upload failed: ${await readGoogleError(put, put.statusText)}`);
  }
  const json = (await put.json()) as { id?: string };
  if (!json.id) {
    throw new PublishError(502, "YouTube upload succeeded but returned no video id");
  }
  return { videoId: json.id };
}
