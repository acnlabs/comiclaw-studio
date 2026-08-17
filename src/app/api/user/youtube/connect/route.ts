import { parseBody, withRouteErrors } from "@/lib/api";
import { badRequest, unauthorized } from "@/lib/auth";
import { youtubeConnectSchema } from "@/lib/schemas";
import { verifyUserToken } from "@/lib/userAuth";
import { youtubeAuthorizeUrl } from "@/lib/youtubeApi";
import {
  signYoutubeOAuthState,
  youtubeSecrets,
} from "@/lib/youtubeCrypto";
import { YOUTUBE_PUBLISH_ERRORS } from "@/lib/youtubePublish";

export const POST = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const secrets = youtubeSecrets();
  if (!secrets) return badRequest(YOUTUBE_PUBLISH_ERRORS.not_configured);

  const body = await parseBody(req, youtubeConnectSchema);
  const state = signYoutubeOAuthState({
    sub,
    returnTo: body.returnTo,
    secret: secrets.tokenSecret,
  });
  return Response.json({
    authorizeUrl: youtubeAuthorizeUrl({
      clientId: secrets.clientId,
      redirectUri: secrets.redirectUri,
      state,
    }),
  });
});
