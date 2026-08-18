import { saveYoutubeAccountFromCode } from "@/lib/youtubePublish";
import {
  sanitizeYoutubeReturnTo,
  verifyYoutubeOAuthState,
  youtubeOAuthCookieHeader,
  youtubeOAuthCookieMatchesState,
  readYoutubeOAuthCookie,
  youtubeSecrets,
} from "@/lib/youtubeCrypto";

function redirectTo(
  origin: string,
  returnTo: string,
  query: Record<string, string>,
) {
  const url = new URL(returnTo, origin);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": youtubeOAuthCookieHeader({ clear: true }),
    },
  });
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const params = new URL(req.url).searchParams;
  const secrets = youtubeSecrets();
  const fallback = sanitizeYoutubeReturnTo(null);

  if (!secrets) {
    return redirectTo(origin, fallback, { youtube: "error", reason: "not_configured" });
  }

  const state = verifyYoutubeOAuthState({
    state: params.get("state") ?? "",
    secret: secrets.tokenSecret,
  });
  const returnTo = state?.returnTo ?? fallback;

  if (params.get("error")) {
    return redirectTo(origin, returnTo, {
      youtube: "error",
      reason: params.get("error") || "denied",
    });
  }
  if (!state) {
    return redirectTo(origin, returnTo, { youtube: "error", reason: "bad_state" });
  }
  const cookieState = readYoutubeOAuthCookie(req.headers.get("cookie"));
  if (!youtubeOAuthCookieMatchesState(cookieState, params.get("state") ?? "")) {
    return redirectTo(origin, returnTo, { youtube: "error", reason: "bad_state" });
  }

  const code = params.get("code")?.trim();
  if (!code) {
    return redirectTo(origin, returnTo, { youtube: "error", reason: "missing_code" });
  }

  try {
    await saveYoutubeAccountFromCode({ ownerUserId: state.sub, code });
    return redirectTo(origin, returnTo, { youtube: "connected" });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 120) : "connect_failed";
    return redirectTo(origin, returnTo, { youtube: "error", reason });
  }
}
