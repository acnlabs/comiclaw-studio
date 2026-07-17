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
// 渲染端防线:agentUrl 必须是 http(s) 绝对地址才会被用作 <a href> 点击目标——
// 写入端(schemas)虽有同样校验,但存量数据早于校验存在,渲染不应依赖写入历史。
export function characterAgentLink(character: {
  acnAgentId: string | null;
  agentUrl: string | null;
}): string | null {
  if (character.acnAgentId) return agentPlanetProfileUrl(character.acnAgentId);
  if (character.agentUrl && /^https?:\/\/\S+$/i.test(character.agentUrl)) {
    return character.agentUrl;
  }
  return null;
}

// comiclaw 是本站点自己的身份(Studio 由它创建/运营),不是某个角色卡的附属信息——
// 全站需要一个固定的"找到 comiclaw"入口,跟具体角色无关。
//
// 链接目标排查记录(2026-07):comiclaw 部署在飞书秒搭上,Gateway 只监听
// loopback,妙搭配的公网 Dashboard 路径(/af/openclaw/)挂在飞书 SSO 后面,
// 只认操作者自己的飞书账号——不是客户能用的入口。真正对客户开放的是飞书
// bot 应用链接(经 comiclaw 自查确认);此前默认指向 AgentPlanet 主页只是没
// 验证过服务能力的占位,已改为这个已验证的真实客户入口。
// 若飞书 bot 的 dmPolicy 尚未从 allowlist 改为 open,这个链接点开后消息会被
// 静默丢弃——务必确认 allowlist 已放开且有基本的滥用防护(限流/成本闩)后
// 才让这个按钮在生产环境生效。
export const COMICLAW_CHAT_URL =
  process.env.NEXT_PUBLIC_COMICLAW_CHAT_URL ??
  "https://applink.feishu.cn/client/chat/open?appId=cli_aac907f86e799cca";
