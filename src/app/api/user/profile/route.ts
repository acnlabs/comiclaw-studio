import { unauthorized } from "@/lib/auth";
import { withRouteErrors } from "@/lib/api";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";
import { syncUserProfileFromAgentPlanet } from "@/lib/agentPlanetUser";

function asJson(profile: { handle: string; displayName: string | null }) {
  return {
    profile: {
      handle: profile.handle,
      displayName: profile.displayName,
      href: `/u/${profile.handle}`,
    },
  };
}

export const GET = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const profile = await syncUserProfileFromAgentPlanet(sub, extractBearerToken(req));
  return Response.json(asJson(profile));
});

// 短名和展示名以 AgentPlanet 为准。这里只再抄一次,不接受客户端改名。
export const PATCH = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const profile = await syncUserProfileFromAgentPlanet(sub, extractBearerToken(req));
  return Response.json(asJson(profile));
});
