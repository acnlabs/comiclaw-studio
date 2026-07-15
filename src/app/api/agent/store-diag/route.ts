import { checkApiKey, unauthorized } from "@/lib/auth";
import { diagnoseStoreConnection } from "@/lib/agentplanet";

// 诊断 Studio ↔ AgentPlanet Store 的连通性与鉴权配置。
// 用完建议删除(排查专用,不属于常驻能力);从不回显 token 明文。
export async function GET(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  const result = await diagnoseStoreConnection();
  return Response.json(result);
}
