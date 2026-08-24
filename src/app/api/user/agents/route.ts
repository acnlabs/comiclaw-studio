import { unauthorized, serverError } from "@/lib/auth";
import { withRouteErrors } from "@/lib/api";
import { verifyUserToken } from "@/lib/userAuth";
import { bearerFromRequest, fetchMyAgents } from "@/lib/myAgents";

/** Human-owned ACN agents via AgentPlanet Chat Gateway. */
export const GET = withRouteErrors(async (req: Request) => {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();
  const token = bearerFromRequest(req);
  if (!token) return unauthorized();

  const agents = await fetchMyAgents(token);
  if (agents == null) {
    return serverError("Could not load your agents from AgentPlanet");
  }
  return Response.json({ agents });
});
