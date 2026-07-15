// AgentPlanet Store 对接层(product_type=agent_asset)。
//
// 付费角色授权走 AgentPlanet Store 的 agent_asset 商品闭环:
//   1. 角色开启付费授权时,Studio 把它上架为 Store 商品(卖家=角色所属智能体);
//   2. 客户发起授权 → Studio 经内部端点下单,拿到 checkout 链接,客户在
//      AgentPlanet 用 Credits 支付(或先充值);
//   3. Studio 轮询/确认订单已支付后落授权,并经 accept-external 放款
//      (平台抽佣后其余进卖家智能体钱包)。
//
// 配置(环境变量):
//   AGENTPLANET_API_URL        如 https://api.agentplanet.org
//   AGENTPLANET_INTERNAL_TOKEN Studio 调用 Store 内部端点的 X-Internal-Token

const BASE = () => (process.env.AGENTPLANET_API_URL ?? "").replace(/\/+$/, "");
const TOKEN = () => process.env.AGENTPLANET_INTERNAL_TOKEN ?? "";

export function storeConfigured(): boolean {
  return Boolean(BASE() && TOKEN());
}

// 诊断:检查配置 + 做一次真实的鉴权调用,返回可安全展示的结果(不回显 token 明文)。
export async function diagnoseStoreConnection(): Promise<{
  configured: boolean;
  baseUrlHost: string | null;
  tokenLength: number;
  publicOk: boolean | null;
  authedStatus: number | null;
  authedBody: string | null;
  error: string | null;
}> {
  const base = BASE();
  const token = TOKEN();
  let baseUrlHost: string | null = null;
  try {
    baseUrlHost = base ? new URL(base).host : null;
  } catch {
    baseUrlHost = null;
  }
  const result = {
    configured: storeConfigured(),
    baseUrlHost,
    tokenLength: token.length,
    publicOk: null as boolean | null,
    authedStatus: null as number | null,
    authedBody: null as string | null,
    error: null as string | null,
  };
  if (!base) {
    result.error = "AGENTPLANET_API_URL not set";
    return result;
  }
  try {
    const pub = await fetch(`${base}/api/store/products`, { cache: "no-store" });
    result.publicOk = pub.ok;
  } catch (e) {
    result.error = `public call failed: ${e instanceof Error ? e.message : String(e)}`;
    return result;
  }
  if (!token) {
    result.error = "AGENTPLANET_INTERNAL_TOKEN not set";
    return result;
  }
  try {
    // 用一个必然会走鉴权分支的内部端点探测:products 上架校验会先过 token 关,
    // 再因缺 seller_id/元数据报 400——用状态码区分「token 错」(401/403)vs「token 对但入参不全」(400/422)。
    const authed = await fetch(`${base}/api/store/agent-assets/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    result.authedStatus = authed.status;
    result.authedBody = (await authed.text()).slice(0, 300);
  } catch (e) {
    result.error = `authed call failed: ${e instanceof Error ? e.message : String(e)}`;
  }
  return result;
}

async function storeFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": TOKEN(),
      ...(init?.headers ?? {}),
    },
    // Store 调用都是短请求;避免 Next 静态化缓存
    cache: "no-store",
  });
}

export interface StoreProduct {
  product_id: string;
  credits_price: number;
  is_active: boolean;
}

export interface StoreOrder {
  order_id: string;
  url: string; // AgentPlanet checkout 页(客户在此用 Credits 支付)
  state: string;
  amount_credits: number;
}

export interface StoreCheckout {
  order_id: string;
  state: string; // pending | fulfilling | completed | refunded | cancelled | expired
  buyer_id: string | null;
  amount_credits: number;
}

// 上架/更新角色为 agent_asset 商品。返回 product_id;失败返回 null(调用方降级处理)。
export async function upsertCharacterListing(args: {
  storeProductId: string | null;
  characterId: string;
  name: string;
  tagline: string | null;
  imageUrl: string;
  sellerAgentId: string; // 收款方:角色所属智能体(ACN agent_id)
  credits: number;
}): Promise<string | null> {
  try {
    if (args.storeProductId) {
      const res = await storeFetch(`/api/store/agent-assets/products/${args.storeProductId}`, {
        method: "PATCH",
        body: JSON.stringify({
          seller_id: args.sellerAgentId,
          name: args.name,
          description: args.tagline,
          credits_price: args.credits,
          is_active: true,
        }),
      });
      if (res.ok) return args.storeProductId;
      // 商品不存在(如 Store 侧被清理)→ 走新建
      if (res.status !== 404) return null;
    }
    const res = await storeFetch(`/api/store/agent-assets/products`, {
      method: "POST",
      body: JSON.stringify({
        seller_id: args.sellerAgentId,
        seller_type: "agent",
        name: args.name,
        description: args.tagline,
        credits_price: args.credits,
        asset_metadata: {
          asset_ref: `comiclaw:character:${args.characterId}`,
          asset_kind: "character",
          source: "comiclaw-studio",
          preview_url: args.imageUrl,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StoreProduct;
    return data.product_id;
  } catch {
    return null;
  }
}

// 下架商品(角色关闭付费/删除时)。best effort。
export async function unlistCharacterListing(
  storeProductId: string,
  sellerAgentId: string
): Promise<void> {
  try {
    await storeFetch(`/api/store/agent-assets/products/${storeProductId}/unlist`, {
      method: "POST",
      body: JSON.stringify({ seller_id: sellerAgentId }),
    });
  } catch {
    // 忽略:下架失败不阻塞主流程,商品残留只影响目录展示
  }
}

// 为一次付费授权创建待支付订单,license_ref 随单携带便于对账。
export async function createCastingOrder(args: {
  storeProductId: string;
  projectId: string;
}): Promise<StoreOrder | null> {
  try {
    const res = await storeFetch(
      `/api/store/agent-assets/products/${args.storeProductId}/order`,
      {
        method: "POST",
        body: JSON.stringify({ license_ref: `comiclaw:project:${args.projectId}` }),
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as StoreOrder;
  } catch {
    return null;
  }
}

// 查询订单状态(Studio 确认支付后落授权)。
export async function getCheckout(orderId: string): Promise<StoreCheckout | null> {
  try {
    const res = await storeFetch(`/api/store/checkout/${orderId}`);
    if (!res.ok) return null;
    return (await res.json()) as StoreCheckout;
  } catch {
    return null;
  }
}

// 授权落地后确认收货 → Store 立即结算放款(平台抽佣 + 卖家所得)。
// 失败不影响授权(验收窗超时会兜底结算),所以 best effort。
export async function acceptCastingOrder(orderId: string, buyerId: string): Promise<void> {
  try {
    await storeFetch(`/api/store/orders/${orderId}/accept-external`, {
      method: "POST",
      body: JSON.stringify({ buyer_id: buyerId }),
    });
  } catch {
    // 忽略:验收窗超时 sweep 兜底
  }
}
