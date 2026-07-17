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

// comiclaw 是本站点自己的身份(Studio 由它创建/运营),不是某个角色卡的附属信息——
// 全站需要一个固定的"找到 comiclaw"入口,跟具体角色无关。链接目标复用与其它
// AgentPlanet 相关链接(钱包、结账)同一套模式:AgentPlanet 主页,唯一验证过
// 真实可用、带 chat 功能的入口。
const COMICLAW_AGENT_ID =
  process.env.NEXT_PUBLIC_COMICLAW_AGENT_ID ?? "390287c9-f7cc-4b6c-82b8-ead10409fb0d";

export const COMICLAW_CHAT_URL =
  process.env.NEXT_PUBLIC_COMICLAW_CHAT_URL ?? agentPlanetProfileUrl(COMICLAW_AGENT_ID);
