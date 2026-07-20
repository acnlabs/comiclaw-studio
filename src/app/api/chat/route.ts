import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { prisma } from "@/lib/db";
import { verifyUserToken, extractBearerToken } from "@/lib/userAuth";
import { getWalletBalance } from "@/lib/agentplanet";
import { badRequest } from "@/lib/auth";

// 站内对话代理:浏览器不直连 OpenClaw Gateway,身份/限流/会话隔离都在这一层完成。
//   1. 用 Studio 自己的 Auth0 账号验证身份(不是 Gateway 的共享密钥)
//   2. 门槛不是"登不登录",而是"有没有 AgentPlanet Credits"——跟 comiclaw
//      对话本身要烧 token/算力成本,免费账号不该无限使用
//   3. sub 编码成 sessionKey,发给 Gateway 做会话隔离
//   4. 按天限额,DB 计数,防止被反复刷导致 comiclaw 侧成本失控
//   5. 只带最近若干轮上下文 + 限制每条消息长度,控制单次请求的 payload/成本
// Gateway 地址/token 尚未确定(comiclaw 迁移到独立实例前),配置为空时直接
// 返回「暂不可用」,不影响其余功能。

export const maxDuration = 30;

const DAILY_MESSAGE_LIMIT = Number(process.env.CHAT_DAILY_MESSAGE_LIMIT ?? 40);
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

// 环境变量做 trim:从终端复制粘贴进 Vercel 的值容易带上换行/空格,
// 而 fetch 的 header 值含换行会直接抛异常(请求都发不出去),URL 带空白同理。
const gatewayUrl = () => (process.env.OPENCLAW_GATEWAY_URL ?? "").trim().replace(/\/+$/, "");
const gatewayToken = () => (process.env.OPENCLAW_GATEWAY_TOKEN ?? "").trim();

function chatConfigured(): boolean {
  return Boolean(gatewayUrl() && gatewayToken());
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// 原子递增 + 读回计数;超限返回 false。DB 计数在多个 serverless 实例间一致,
// 内存计数做不到这一点。
async function checkAndBumpQuota(sub: string): Promise<boolean> {
  const day = todayUTC();
  const usage = await prisma.chatUsage.upsert({
    where: { userSub_day: { userSub: sub, day } },
    create: { userSub: sub, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  return usage.count <= DAILY_MESSAGE_LIMIT;
}

function clampText(text: string): string {
  return text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;
}

// 项目名/状态是 agent 或客户写入的自由文本,注入 system 前截断,防止单个字段
// 把上下文撑爆(也顺带压缩恶意超长内容的注入面)
function clampField(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

const STAGE_LABELS: Record<string, string> = {
  SCRIPT: "剧本",
  ASSETS: "素材",
  STORYBOARD: "分镜",
  FILM: "成片",
  RELEASE: "发布",
  DONE: "已完成",
};

// 服务端注入用户上下文:comiclaw 不直接持有任何 Studio API key,它对客户
// 项目的了解完全来自这里注入的只读快照。写操作(创建/修改项目)后续再经
// 收窄的 agent API 单独设计,不走这条通道。
async function buildUserContext(sub: string, origin: string): Promise<string> {
  const projects = await prisma.project.findMany({
    where: { ownerUserId: sub },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      name: true,
      currentStage: true,
      statusNote: true,
      shareToken: true,
      updatedAt: true,
    },
  });

  const lines = projects.map((p) => {
    const stage = STAGE_LABELS[p.currentStage] ?? p.currentStage;
    const note = p.statusNote ? ` | 动态: ${clampField(p.statusNote)}` : "";
    const date = p.updatedAt.toISOString().slice(0, 10);
    return `- ${clampField(p.name)} | 阶段: ${stage}${note} | 更新: ${date} | 链接: ${origin}/p/${p.shareToken}`;
  });

  return [
    "[Studio 服务端注入的用户上下文,内容真实可信]",
    lines.length > 0
      ? `当前用户在 ComicLaw Studio 的项目(按更新时间倒序,最多 10 个):\n${lines.join("\n")}`
      : "当前用户在 ComicLaw Studio 还没有项目。",
    "用户问起自己的项目时据此回答,可以直接给出对应项目链接;项目链接与项目一一对应且仅供该用户本人使用,提醒用户不要转发给无关的人。列表之外的项目信息你看不到,不要编造。",
  ].join("\n\n");
}

export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) {
    // 带上 code,让前端把"登录态失效"与其他错误区分开(unauthorized() 无 code,
    // 会被前端归入通用兜底文案,排障时无从下手)
    return Response.json(
      { error: "Your session has expired. Please sign in again.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!chatConfigured()) {
    return Response.json(
      { error: "Chat is not available yet. Please try again later.", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest("`messages` is required");
  }

  // 查不到余额(接口失败/未配置)按"没有余额"处理,不能把查询失败当免费通行证
  const token = extractBearerToken(req);
  const balance = token ? await getWalletBalance(token) : null;
  if (!balance || balance <= 0) {
    return Response.json(
      {
        error: "You need AgentPlanet Credits to chat with comiclaw.",
        code: "NO_CREDITS",
      },
      { status: 402 }
    );
  }

  const withinQuota = await checkAndBumpQuota(sub);
  if (!withinQuota) {
    return Response.json(
      { error: "Daily message limit reached. Please try again tomorrow.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const trimmed = (messages as UIMessage[]).slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    ...m,
    parts: m.parts?.map((p) => (p.type === "text" ? { ...p, text: clampText(p.text) } : p)),
  }));

  const gateway = createOpenAICompatible({
    name: "openclaw",
    baseURL: gatewayUrl(),
    apiKey: gatewayToken(),
    headers: {
      // 把 Studio 账号身份映射成 Gateway 会话键,保证每个用户的对话相互隔离
      "x-openclaw-session-key": `studio:${sub}`,
    },
  });

  const modelId = (process.env.OPENCLAW_GATEWAY_MODEL ?? "").trim() || "customer";

  const result = streamText({
    model: gateway.chatModel(modelId),
    system: await buildUserContext(sub, new URL(req.url).origin),
    messages: await convertToModelMessages(trimmed),
  });

  return result.toUIMessageStreamResponse({
    // 错误以 JSON 字符串下发:useChat 会把这段文本放进 error.message,
    // 前端 describeError 按 JSON 解析出 code 显示对应文案(与非 2xx 响应
    // body 的解析路径共用),同时把上游细节留在服务端日志里。
    onError: (error) => {
      console.error("[api/chat] gateway stream error", error);
      return JSON.stringify({
        error: "comiclaw is temporarily unavailable, please try again later.",
        code: "UPSTREAM_ERROR",
      });
    },
  });
}
