import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

const BOX_PREFIX = "v1:";
const STATE_TTL_MS = 15 * 60 * 1000;

export function youtubeSecrets(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenSecret: string;
} | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim() || "";
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI?.trim() || "";
  const tokenSecret = process.env.YOUTUBE_TOKEN_SECRET?.trim() || "";
  if (!clientId || !clientSecret || !redirectUri || !tokenSecret) return null;
  if (tokenSecret.length < 16) return null;
  return { clientId, clientSecret, redirectUri, tokenSecret };
}

export function youtubeConfigured(): boolean {
  return youtubeSecrets() !== null;
}

function aesKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return BOX_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptSecret(packed: string, secret: string): string {
  if (!packed.startsWith(BOX_PREFIX)) {
    throw new Error("Unsupported secret encoding");
  }
  const raw = Buffer.from(packed.slice(BOX_PREFIX.length), "base64url");
  if (raw.length < 12 + 16 + 1) {
    throw new Error("Corrupt secret encoding");
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", aesKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export type YoutubeOAuthState = {
  sub: string;
  returnTo: string;
  exp: number;
};

export function sanitizeYoutubeReturnTo(returnTo: string | null | undefined): string {
  const raw = (returnTo ?? "").trim();
  if (!raw.startsWith("/")) return "/studio";
  if (raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return "/studio";
  if (!(raw.startsWith("/p/") || raw.startsWith("/studio"))) return "/studio";
  if (raw.length > 200) return "/studio";
  return raw;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signYoutubeOAuthState(args: {
  sub: string;
  returnTo?: string | null;
  now?: number;
  secret: string;
}): string {
  const body: YoutubeOAuthState = {
    sub: args.sub,
    returnTo: sanitizeYoutubeReturnTo(args.returnTo),
    exp: (args.now ?? Date.now()) + STATE_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload, args.secret)}`;
}

export function verifyYoutubeOAuthState(args: {
  state: string;
  secret: string;
  now?: number;
}): YoutubeOAuthState | null {
  const dot = args.state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = args.state.slice(0, dot);
  const sig = args.state.slice(dot + 1);
  const expected = signPayload(payload, args.secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as YoutubeOAuthState;
    if (!body.sub?.trim() || typeof body.exp !== "number") return null;
    if ((args.now ?? Date.now()) > body.exp) return null;
    return {
      sub: body.sub,
      returnTo: sanitizeYoutubeReturnTo(body.returnTo),
      exp: body.exp,
    };
  } catch {
    return null;
  }
}
