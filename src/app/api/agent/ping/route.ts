import { authenticateStudioOrAcnAgent } from "@/lib/acnAuth";

// 技能自检:STUDIO_API_KEY 或工人自己的 ACN Bearer 均可。
export async function GET(req: Request) {
  const auth = await authenticateStudioOrAcnAgent(req);
  if (auth instanceof Response) return auth;
  if (auth.kind === "studio_key") {
    return Response.json({ ok: true, service: "comiclaw-studio", auth: "studio_key" });
  }
  return Response.json({
    ok: true,
    service: "comiclaw-studio",
    auth: "acn_agent",
    agentId: auth.agentId,
  });
}
