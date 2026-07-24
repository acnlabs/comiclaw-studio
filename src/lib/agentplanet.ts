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

// 查询用户自己的 Credits 余额(用户态接口,转发客户自己的 Auth0 token,
// 不用内部令牌)。查不到时返回 null,调用方决定如何降级——通常应该按
// "没有余额"处理,而不是放行,避免把查询失败当成免费通行证。
export async function getWalletBalance(userBearerToken: string): Promise<number | null> {
  if (!BASE() || !userBearerToken) return null;
  try {
    const res = await fetch(`${BASE()}/api/users/me/wallet`, {
      headers: { Authorization: `Bearer ${userBearerToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.balance === "number" ? data.balance : null;
  } catch {
    return null;
  }
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

// 校验 agent 是否真实存在于 AgentPlanet(公开端点,无需令牌)。
// 返回 true/false;网络失败返回 null(调用方决定阻塞还是放行)。
export async function verifyAgentExists(agentId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${BASE()}/api/agents/${encodeURIComponent(agentId)}`, {
      cache: "no-store",
    });
    if (res.ok) return true;
    if (res.status === 404 || res.status === 400) return false;
    return null; // 5xx 等非预期状态:视为暂不可验证
  } catch {
    return null;
  }
}

// ---- 资产登记表(平台级产权账本;ap-backend /api/store/asset-registry)----
// 登记的是产权与指针;付费角色上架前登记,产权人 = 收款智能体。

const assetRef = (characterId: string) => `comiclaw:character:${characterId}`;

// 登记角色产权。"exists"(409)表示此前已登记——产权人可能是旧收款方,
// 调用方须随后 change-owner 对齐,否则上架会被登记表的 seller 校验挡住。
export async function registerCharacterAsset(args: {
  characterId: string;
  ownerAgentId: string;
  displayName: string;
}): Promise<"registered" | "exists" | "failed"> {
  try {
    const res = await storeFetch(`/api/store/asset-registry`, {
      method: "POST",
      body: JSON.stringify({
        asset_ref: assetRef(args.characterId),
        source: "comiclaw-studio",
        asset_kind: "character",
        owner_type: "agent",
        owner_id: args.ownerAgentId,
        display_name: args.displayName,
        bound_agent_id: args.ownerAgentId,
      }),
    });
    if (res.ok) return "registered";
    if (res.status === 409) return "exists";
    return "failed";
  } catch {
    return "failed";
  }
}

// 产权变更(客户改绑收款智能体)。404 = 从未登记过,调用方随后走 register 即可。
export async function changeCharacterAssetOwner(
  characterId: string,
  newAgentId: string
): Promise<void> {
  try {
    await storeFetch(`/api/store/asset-registry/${encodeURIComponent(assetRef(characterId))}/change-owner`, {
      method: "POST",
      body: JSON.stringify({ owner_type: "agent", owner_id: newAgentId, reason: "rebind" }),
    });
  } catch {
    // best effort:失败时新商品上架会被登记表挡住,不会造成错误收款
  }
}

// 注销登记(角色删除时)。best effort、幂等。
export async function revokeCharacterAsset(characterId: string): Promise<void> {
  try {
    await storeFetch(`/api/store/asset-registry/${encodeURIComponent(assetRef(characterId))}/revoke`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // 忽略:注销失败只影响登记表整洁度;死资产的新订单会被下单时点核对挡住
  }
}

export interface StoreListingStatus {
  product_id: string;
  credits_price: number;
  is_active: boolean;
  review_status: string | null; // pending | approved | rejected
  review_reason: string | null; // 被拒原因(机器可读,供卖家 agent 修改后重新上架)
}

// 查询商品的审核/上架状态(公开目录不回显审核字段,须经内部端点)。
export async function getCharacterListing(
  storeProductId: string
): Promise<StoreListingStatus | null> {
  try {
    const res = await storeFetch(`/api/store/agent-assets/products/${storeProductId}`);
    if (!res.ok) return null;
    return (await res.json()) as StoreListingStatus;
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
// returnUrl 是可选的支付完成后跳转回调(Store/checkout 前端若支持,会在支付
// 成功后把浏览器带回这个地址;目前 AgentPlanet 前端尚未实现跳转,传了也无副作用,
// 是否落地取决于对方——不影响 Studio 侧的轮询/自愈兜底路径)。
export async function createCastingOrder(args: {
  storeProductId: string;
  projectId: string;
  returnUrl?: string;
}): Promise<StoreOrder | null> {
  try {
    const res = await storeFetch(
      `/api/store/agent-assets/products/${args.storeProductId}/order`,
      {
        method: "POST",
        body: JSON.stringify({
          license_ref: `comiclaw:project:${args.projectId}`,
          ...(args.returnUrl ? { return_url: args.returnUrl } : {}),
        }),
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as StoreOrder;
  } catch {
    return null;
  }
}

// AgentPlanet 前端(checkout 页)的站点地址,用于重建已存在订单的 checkout 链接。
const APP_ORIGIN = () =>
  (process.env.NEXT_PUBLIC_AGENTPLANET_APP_URL ?? "https://agentplanet.org").replace(/\/+$/, "");

export function checkoutUrl(orderId: string): string {
  return `${APP_ORIGIN()}/store/checkout/${orderId}`;
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

// ---- 生产用量按次扣款(官方受信服务端专用接口,与 Store/Escrow 是三条独立路径)----
//
// 主 comiclaw 生产时,每次调用即梦/Seedance 等上游生成前先经这个接口扣款:
// 用户 balance 减少,收款方(comiclaw 智能体) balance 增加。这不是给社区任意
// agent 用的通用接口——鉴权靠共享的 X-Internal-Token,且 AgentPlanet 侧的
// SERVICE_CHARGE_ALLOWLIST 限定了 source(=comiclaw-studio) 能替哪个
// agent_id(主 comiclaw 在 AgentPlanet 的 UUID) 扣款。
//
// 配置(环境变量,复用 Store 用的同一把内部令牌):
//   AGENTPLANET_INTERNAL_TOKEN   与 Store 内部端点共享的 X-Internal-Token
//   AGENTPLANET_AGENT_ID         收款方 agent_id(AgentPlanet UUID;勿填展示名 "comiclaw")
//   AGENTPLANET_CHARGE_SOURCE    调用方 source 标识,默认 "comiclaw-studio"

/** 主 comiclaw 在 AgentPlanet 的收款 agent UUID(不是 ACN id,也不是展示名) */
const DEFAULT_CHARGE_AGENT_ID = "390287c9-f7cc-4b6c-82b8-ead10409fb0d";
const CHARGE_AGENT_ID = () =>
  (process.env.AGENTPLANET_AGENT_ID ?? "").trim() || DEFAULT_CHARGE_AGENT_ID;
const CHARGE_SOURCE = () => process.env.AGENTPLANET_CHARGE_SOURCE ?? "comiclaw-studio";

export interface WalletChargeSuccess {
  ok: true;
  userId: string;
  amount: number;
  balance: number; // 扣款后用户余额
  transactionId: string;
  idempotent: boolean; // true = 命中同一幂等键的历史记录,未重复扣款
}

export interface WalletChargeFailure {
  ok: false;
  code: "INSUFFICIENT_BALANCE" | "NOT_CONFIGURED" | "ERROR";
  status?: number;
  balance?: number; // 402 时 AgentPlanet 会带上当前余额
  required?: number; // 402 时带上本次所需金额
  message?: string;
}

export type WalletChargeResult = WalletChargeSuccess | WalletChargeFailure;

// 按次扣款。amount 必须 > 0;idempotencyKey 建议 `comiclaw:gen:{jobId}`,
// 保证同一次生成动作(网络重试/agent 重跑)不会被扣两次款——AgentPlanet
// 自己的幂等键是权威防线,本地 GenerationChargeRef 的唯一约束只是排障用的
// 第二道校验,不影响资金正确性。
export async function chargeWalletUsage(args: {
  userSub: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): Promise<WalletChargeResult> {
  if (!BASE() || !TOKEN()) return { ok: false, code: "NOT_CONFIGURED" };
  try {
    const res = await storeFetch(`/api/internal/wallet/charge`, {
      method: "POST",
      body: JSON.stringify({
        user_id: args.userSub,
        amount: args.amount,
        agent_id: CHARGE_AGENT_ID(),
        source: CHARGE_SOURCE(),
        reason: args.reason,
        idempotency_key: args.idempotencyKey,
        ...(args.projectId ? { project_id: args.projectId } : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      }),
    });
    if (res.status === 402) {
      const detail = await res.json().catch(() => null);
      return {
        ok: false,
        code: "INSUFFICIENT_BALANCE",
        status: 402,
        balance: detail?.detail?.balance,
        required: detail?.detail?.required,
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, code: "ERROR", status: res.status, message: text.slice(0, 500) };
    }
    const data = await res.json();
    return {
      ok: true,
      userId: data.user_id,
      amount: data.amount,
      balance: data.balance,
      transactionId: data.transaction_id,
      idempotent: Boolean(data.idempotent),
    };
  } catch (err) {
    return { ok: false, code: "ERROR", message: err instanceof Error ? err.message : String(err) };
  }
}
