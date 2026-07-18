import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { prisma } from "@/lib/db";
import { verifyUserToken, extractBearerToken } from "@/lib/userAuth";
import { getWalletBalance } from "@/lib/agentplanet";
import { unauthorized, badRequest } from "@/lib/auth";

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

function chatConfigured(): boolean {
  return Boolean(process.env.OPENCLAW_GATEWAY_URL && process.env.OPENCLAW_GATEWAY_TOKEN);
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

export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) return unauthorized();

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
    baseURL: process.env.OPENCLAW_GATEWAY_URL!,
    apiKey: process.env.OPENCLAW_GATEWAY_TOKEN!,
    headers: {
      // 把 Studio 账号身份映射成 Gateway 会话键,保证每个用户的对话相互隔离
      "x-openclaw-session-key": `studio:${sub}`,
    },
  });

  const modelId = process.env.OPENCLAW_GATEWAY_MODEL || "customer";

  const result = streamText({
    model: gateway.chatModel(modelId),
    messages: await convertToModelMessages(trimmed),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[api/chat] gateway stream error", error);
      return "comiclaw is temporarily unavailable, please try again later.";
    },
  });
}
