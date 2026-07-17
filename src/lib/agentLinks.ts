// 客户端可用的 AgentPlanet / comiclaw 链接常量(NEXT_PUBLIC_ 前缀,构建时内联)。
//
// 角色卡上的智能体链接:优先用已验证过真实存在的 acnAgentId 反推出规范的
// AgentPlanet 主页(https://agentplanet.org/agents/{id}),而不是直接信任角色
// 自由填写的 agentUrl 字段——后者是自由文本,填错没人拦得住(comiclaw 自己的
// 角色卡就出现过 agentUrl 指向不存在的地址)。只有 acnAgentId 缺失时才退回
// agentUrl(比如智能体不在 AgentPlanet 注册,想链到自己的主页)。

const AGENTPLANET_APP_URL = (
  process.env.NEXT_PUBLIC_AGENTPLANET_APP_URL ?? "https://agentplanet.org"
).replace(/\/+$/, "");

export function agentPlanetProfileUrl(agentId: string): string {
  return `${AGENTPLANET_APP_URL}/agents/${encodeURIComponent(agentId)}`;
}

// 角色卡「查看智能体」链接:acnAgentId 优先(规范、已验证),否则退回自由文本 agentUrl。
export function characterAgentLink(character: {
  acnAgentId: string | null;
  agentUrl: string | null;
}): string | null {
  if (character.acnAgentId) return agentPlanetProfileUrl(character.acnAgentId);
  return character.agentUrl;
}
