import { withAgentAuth } from "@/lib/api";
import { badRequest } from "@/lib/auth";
import { getAssetRegistrationRaw } from "@/lib/agentplanet";
import {
  planRetirement,
  retireConfigured,
  runRetirement,
} from "@/lib/characterRefRetire";

/**
 * One-time cleanup of registry entries still keyed by a character's own id
 * (`STUDIO_API_KEY`).
 *
 * It lives here rather than in a script because seeing the plan needs the same
 * production credentials as applying it, and nobody should be copying those
 * onto a laptop to find out whether there is anything to clean up.
 *
 * GET = plan (reads only), POST = apply.
 */
export const GET = withAgentAuth(async (req: Request) => {
  if (!retireConfigured()) {
    return badRequest("AgentPlanet store is not configured on this server");
  }
  const stale = await planRetirement();

  // ?raw=1 附上登记条目的原始响应。判断「注销了没有」只能看对方到底返回了
  // 什么,而我们的读取只挑 owner 字段——差异藏在被丢掉的那部分里。
  if (new URL(req.url).searchParams.get("raw") === "1") {
    const raw = await Promise.all(
      stale.map(async (s) => ({
        characterId: s.characterId,
        ...(await getAssetRegistrationRaw("character", s.characterId)),
      }))
    );
    return Response.json({ stale, count: stale.length, raw });
  }

  return Response.json({ stale, count: stale.length });
});

export const POST = withAgentAuth(async () => {
  if (!retireConfigured()) {
    return badRequest("AgentPlanet store is not configured on this server");
  }
  const results = await runRetirement();
  return Response.json({
    results,
    retired: results.filter((r) => r.revoked).length,
    failed: results.filter((r) => !r.revoked).length,
  });
});
