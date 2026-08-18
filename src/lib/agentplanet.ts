import {
  ASSET_SOURCE,
  assetRef,
  registerAssetPayload,
  registryActionPath,
  registryEntryPath,
  REGISTRY_PATH,
  storeProductPath,
  STORE_PRODUCTS_PATH,
  isStoreListableKind,
  type AssetKind,
  type AssetOwner,
  type ChangeOwnerReason,
  type RegisterAssetArgs,
  type RegisterResult,
} from "@/lib/assetRegistry";
import { refuseExternalWrite } from "@/lib/externalWrites";

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
  const refused = refuseExternalWrite("agentplanet", init?.method, path);
  if (refused) return refused;
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


// 上架/更新资产为 agent_asset 商品。返回 product_id;失败返回 null(调用方降级处理)。
// seller 必须与登记表的产权人一致(user | agent | org),否则 Store 403。
export async function upsertAssetListing(args: {
  storeProductId: string | null;
  kind: AssetKind;
  localId: string;
  name: string;
  tagline: string | null;
  imageUrl: string | null;
  owner: AssetOwner;
  credits: number;
}): Promise<string | null> {
  if (!isStoreListableKind(args.kind)) {
    console.error("[agentplanet] refusing to list a non-store kind", args.kind);
    return null;
  }
  try {
    if (args.storeProductId) {
      const res = await storeFetch(storeProductPath(args.storeProductId), {
        method: "PATCH",
        body: JSON.stringify({
          // unlist 与商品 PATCH 只认 seller_id;多传 seller_type 会被忽略
          seller_id: args.owner.id,
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
    const res = await storeFetch(STORE_PRODUCTS_PATH, {
      method: "POST",
      body: JSON.stringify({
        seller_type: args.owner.type,
        seller_id: args.owner.id,
        name: args.name,
        description: args.tagline,
        credits_price: args.credits,
        asset_metadata: {
          asset_ref: assetRef(args.kind, args.localId),
          asset_kind: args.kind,
          source: ASSET_SOURCE,
          ...(args.imageUrl ? { preview_url: args.imageUrl } : {}),
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
function publicAgentApiBases(): string[] {
  const seen = new Set<string>();
  const bases: string[] = [];
  for (const raw of [
    "https://api.agentplanet.org",
    process.env.NEXT_PUBLIC_AGENTPLANET_API_URL,
    process.env.AGENTPLANET_API_URL,
  ]) {
    const base = raw?.trim().replace(/\/+$/, "");
    if (!base || seen.has(base)) continue;
    seen.add(base);
    bases.push(base);
  }
  return bases;
}

/** 公开主页用的展示名。查不到或网络失败时返回 null,页面再找片子上的署名。 */
export async function fetchAgentDisplayName(agentId: string): Promise<string | null> {
  const id = agentId.trim();
  if (!id) return null;
  for (const base of publicAgentApiBases()) {
    try {
      const res = await fetch(`${base}/api/agents/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        display_name?: string;
        displayName?: string;
        name?: string;
      };
      const name =
        data.display_name?.trim() || data.displayName?.trim() || data.name?.trim();
      if (name) return name;
    } catch {
      // 换下一个基址
    }
  }
  return null;
}

export async function liveAgentNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (id) => [id, await fetchAgentDisplayName(id)] as const),
  );
  return new Map(
    pairs.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
}

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

// ---- 资产登记表(平台级产权账本)----
// 主路径 /api/assets/registry;旧的 /api/store/asset-registry 仍兼容,新代码不再写。
// 登记的是产权与指针。产权人可以是 user / agent / org;上架时 seller 必须与
// 产权人一致,否则 Store 403。形象绑定(bound_agent_id)与产权分开维护。

/** 登记产权。"exists"(409)表示此前登记过,产权人可能是旧的 → 调用方随后 change-owner 对齐。 */
export async function registerAsset(
  args: RegisterAssetArgs
): Promise<RegisterResult> {
  try {
    const res = await storeFetch(REGISTRY_PATH, {
      method: "POST",
      body: JSON.stringify(registerAssetPayload(args)),
    });
    if (res.ok) return "registered";
    if (res.status === 409) return "exists";
    return "failed";
  } catch {
    return "failed";
  }
}

export interface AssetRegistration {
  owner_type: string;
  owner_id: string;
  status?: string;
}

/**
 * 注销不会删掉登记行,只把 status 改成 `revoked`——所以「拿到了带 owner 的响应」
 * 不等于「登记有效」。这个判定是收钱前那道确认的一部分,必须 fail-closed:
 * 只有明确 active(或旧行根本没有这个字段)才算有效。
 */
function registrationIsLive(status: unknown): boolean {
  if (status == null || status === "") return true;
  return status === "active";
}

/**
 * 读回登记态。用于「确认」而不是「写入」的场合——买家下单前要确认资产确实登记
 * 过(enforce 下未登记不可下单),但绝不该顺手改卖家的商品。
 * 查不到或不可达返回 null,调用方按「没登记」处理。
 */
/**
 * 登记条目的原始响应。只给排障用:判断「是否有效登记」必须走
 * getAssetRegistration,别在业务里读这个。
 */
export async function getAssetRegistrationRaw(
  kind: AssetKind,
  localId: string
): Promise<{ status: number | null; body: unknown }> {
  try {
    const res = await storeFetch(registryEntryPath(assetRef(kind, localId)));
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (err) {
    return { status: null, body: err instanceof Error ? err.message : String(err) };
  }
}

export async function getAssetRegistration(
  kind: AssetKind,
  localId: string
): Promise<AssetRegistration | null> {
  try {
    const res = await storeFetch(registryEntryPath(assetRef(kind, localId)));
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<AssetRegistration> | null;
    if (typeof data?.owner_type !== "string" || typeof data?.owner_id !== "string") {
      return null;
    }
    if (!registrationIsLive(data.status)) return null;
    return {
      owner_type: data.owner_type,
      owner_id: data.owner_id,
      status: typeof data.status === "string" ? data.status : undefined,
    };
  } catch {
    return null;
  }
}

/** 改展示名 / 改出镜 Agent。产权变更不走这里,走 change-owner。 */
export async function patchAsset(
  kind: AssetKind,
  localId: string,
  patch: { displayName?: string; boundAgentId?: string | null }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.displayName !== undefined) body.display_name = patch.displayName;
  if (patch.boundAgentId !== undefined) body.bound_agent_id = patch.boundAgentId;
  if (Object.keys(body).length === 0) return;
  try {
    await storeFetch(
      registryEntryPath(assetRef(kind, localId)),
      { method: "PATCH", body: JSON.stringify(body) }
    );
  } catch {
    // best effort:登记表展示名不同步只影响目录可读性,不影响收款
  }
}

/**
 * 产权变更(人→Agent、Agent→Org 等)。404 = 从未登记,调用方随后 register 即可。
 * 返回是否确实改成了:调用方若要据此写本地产权,必须先看这个结果,否则本地
 * 与登记表会各说各话,之后上架被 seller != owner 挡住。
 */
export async function changeAssetOwner(
  kind: AssetKind,
  localId: string,
  owner: AssetOwner,
  // 只有 rebind | admin 会被接受;sale 由对方的订单闭环独占。传别的词会被拒,
  // 而调用方是 fail-closed 的,所以拒绝会直接变成用户看到的 503。
  reason: ChangeOwnerReason = "rebind"
): Promise<boolean> {
  try {
    const res = await storeFetch(
      registryActionPath(assetRef(kind, localId), "change-owner"),
      {
        method: "POST",
        body: JSON.stringify({
          owner_type: owner.type,
          owner_id: owner.id,
          reason,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 注销登记。幂等:404(从未登记/已注销)视为成功。
 * 返回是否确实注销:撤销发布必须等它成功才能清本地状态,否则本地说"没发布"、
 * 登记表还留着,项目就能被删掉,留下真正的孤儿登记。
 */
export async function revokeAsset(
  kind: AssetKind,
  localId: string
): Promise<boolean> {
  return (await revokeAssetDetailed(kind, localId)).ok;
}

/**
 * 同上,但把远端的状态带回来。注销失败时「对方说了什么」是唯一能定位原因的
 * 线索——只回一个 false 的话,路径不对、方法不对、鉴权不对全都长一样。
 */
export async function revokeAssetDetailed(
  kind: AssetKind,
  localId: string
): Promise<{ ok: boolean; status: number | null; detail: string | null }> {
  const path = registryActionPath(assetRef(kind, localId), "revoke");
  try {
    const res = await storeFetch(path, { method: "POST", body: JSON.stringify({}) });
    const detail = res.ok ? null : (await res.text().catch(() => "")).slice(0, 300);
    return { ok: res.ok || res.status === 404, status: res.status, detail };
  } catch (err) {
    return {
      ok: false,
      status: null,
      detail: err instanceof Error ? err.message : String(err),
    };
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
    const res = await storeFetch(storeProductPath(storeProductId));
    if (!res.ok) return null;
    return (await res.json()) as StoreListingStatus;
  } catch {
    return null;
  }
}

// 下架商品(关闭付费/删除时)。best effort。
// 端点只读 seller_id —— 是「只读这一个字段」,不是「不需要它」:它用来匹配卖家,
// 不发会有下架失败、商品继续在售的风险,而失败在这里是被吞掉的。
/**
 * 下架商品。返回是否成功而不是抛错:多数调用方把下架当收尾,失败只留一个
 * 目录残留。但要在下架之后注销登记的调用方必须能看到失败——那种组合会留下
 * 「能付款、拿不到货」的状态,是唯一真会伤到人的一种。
 */
export async function unlistAssetListing(
  storeProductId: string,
  sellerId: string
): Promise<boolean> {
  try {
    const res = await storeFetch(storeProductPath(storeProductId, "unlist"), {
      method: "POST",
      body: JSON.stringify({ seller_id: sellerId }),
    });
    // storeFetch 不对非 2xx 抛错,所以这里必须自己看状态:
    // 404 视为已经不在架上,与注销的幂等口径一致
    if (res.ok || res.status === 404) return true;
    console.error("[agentplanet] unlist rejected", storeProductId, res.status);
    return false;
  } catch (err) {
    console.error("[agentplanet] unlist unreachable", storeProductId, err);
    return false;
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
      storeProductPath(args.storeProductId, "order"),
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
// agent_id(=comiclaw) 扣款。
//
// 配置(环境变量,复用 Store 用的同一把内部令牌):
//   AGENTPLANET_INTERNAL_TOKEN   与 Store 内部端点共享的 X-Internal-Token
//   CHARGE_PAYEE_AGENT_ID        收款方 agent_id(本 Studio 总包),默认 "comiclaw"
//                                兼容旧名 AGENTPLANET_AGENT_ID
//   AGENTPLANET_CHARGE_SOURCE    调用方 source 标识,默认 "comiclaw-studio"
//
// 注意:CHARGE_PAYEE_AGENT_ID 是「本服务向 AP 扣款时的收款 Agent」,
// 不是 AgentPlanet 平台自己的企业 Agent。其他对接方各自配置自己的收款 ID。

const CHARGE_AGENT_ID = () =>
  process.env.CHARGE_PAYEE_AGENT_ID ??
  process.env.AGENTPLANET_AGENT_ID ?? // legacy alias
  "comiclaw";
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
