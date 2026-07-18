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

// 曾在这里维护过一个全站固定的外部"找 comiclaw"链接常量(先后指向 AgentPlanet
// 主页、飞书 bot 深链接),现在都撤了——comiclaw 的海外新实例跟飞书没有关系,
// 而且真正的门槛不是"有没有登录",是"有没有 AgentPlanet Credits"(见 SiteNav /
// ChatWidget:未登录引导登录,登录但没 Credits 引导去钱包充值)。等 comiclaw 在
// AgentPlanet Store 上架订阅商品后,再在这里补一个指向该商品页的常量,用作
// "还不是客户"时的引导链接。
