import { checkApiKey, unauthorized } from "@/lib/auth";

// 技能自检端点:验证地址与密钥。旧部署快照没有此路由(404),可用于识别过期地址。
export async function GET(req: Request) {
  if (!checkApiKey(req)) return unauthorized();
  return Response.json({ ok: true, service: "comiclaw-studio" });
}
