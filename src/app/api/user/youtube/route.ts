import { withRouteErrors } from "@/lib/api";
import { unauthorized } from "@/lib/auth";
import { verifyUserToken } from "@/lib/userAuth";
import { youtubeConfigured } from "@/lib/youtubeCrypto";
import {
  disconnectYoutubeAccount,
  getYoutubeAccountPublic,
} from "@/lib/youtubePublish";

export const GET = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const account = await getYoutubeAccountPublic(sub);
  return Response.json({
    configured: youtubeConfigured(),
    ...account,
  });
});

export const DELETE = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

  const removed = await disconnectYoutubeAccount(sub);
  return Response.json({ disconnected: removed });
});
