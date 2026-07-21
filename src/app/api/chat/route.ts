import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
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

// 工具循环最多要跑两轮模型调用(决定调用 → 拿结果 → 组织回复),30s 会顶到头
export const maxDuration = 60;

const DAILY_MESSAGE_LIMIT = Number(process.env.CHAT_DAILY_MESSAGE_LIMIT ?? 40);
const DAILY_PROJECT_LIMIT = Number(process.env.CHAT_DAILY_PROJECT_LIMIT ?? 3);
// 临时止血,在 Studio 全量接入按用量扣款(AgentPlanet /api/internal/wallet/charge)
// 之前的过渡门槛:下单建项目要求余额覆盖至少一笔视频的生成成本,而不是
// "> 0 就能建"——生产阶段真正花钱时会再按次扣款,这里只是拦掉"1 个 Credit
// 白嫖一个项目"这种明显漏洞。
const MIN_PROJECT_CREDITS = Number(process.env.CHAT_MIN_PROJECT_CREDITS ?? 30);
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
// 项目的了解完全来自这里注入的只读快照;写操作(创建项目)通过下面的
// server-side tool 在 Studio 进程内执行,归属人由已验证的身份强制指定。
async function buildUserContext(sub: string, origin: string, balance: number): Promise<string> {
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
    "当用户想新做一个短剧/短视频项目时:先和用户确认项目名称与需求描述,确认后调用 createProject 工具创建(项目自动归属当前用户),然后把返回的项目链接发给用户。不要在用户未确认前创建。",
    `当前用户的 AgentPlanet Credits 余额: ${balance}。制作一个视频至少需要 ${MIN_PROJECT_CREDITS} Credits,余额不足时如实告知用户需要先充值,不要代为承诺可以免费制作。`,
  ].join("\n\n");
}

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// 写能力走 server-side tool:网关把工具调用透传回本路由,execute 在 Studio
// 进程内跑——归属人直接取当次请求已验证的 Auth0 身份,模型没有任何参数能
// 指定别人;客户 cell 全程零工具、零密钥,不存在混淆代理人问题。
function buildTools(sub: string, origin: string, balance: number) {
  return {
    createProject: tool({
      description:
        "为当前用户创建一个新的短剧/短视频项目。仅在用户明确确认项目名称和需求后调用。",
      inputSchema: z.object({
        name: z.string().min(1).max(80).describe("项目名称,例如「XX品牌 15s 宣传短视频」"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("用户的需求描述:内容方向、时长、风格、参考等"),
      }),
      execute: async ({ name, description }) => {
        // 建项目本身免费,但生产会真实消耗 Credits(按次扣款);余额太低时
        // 现在拦下,好过建了项目又在生产阶段反复因余额不足卡住
        if (balance < MIN_PROJECT_CREDITS) {
          return {
            ok: false,
            error: `制作一个视频至少需要 ${MIN_PROJECT_CREDITS} Credits(当前余额 ${balance}),请先充值。`,
          };
        }
        const createdToday = await prisma.project.count({
          where: { ownerUserId: sub, createdAt: { gte: startOfTodayUTC() } },
        });
        if (createdToday >= DAILY_PROJECT_LIMIT) {
          return {
            ok: false,
            error: `今日创建项目数已达上限(${DAILY_PROJECT_LIMIT} 个),请明天再来。`,
          };
        }
        const project = await prisma.project.create({
          data: {
            name: name.trim(),
            description: description?.trim() || null,
            ownerUserId: sub,
          },
        });
        return {
          ok: true,
          name: project.name,
          stage: STAGE_LABELS[project.currentStage] ?? project.currentStage,
          link: `${origin}/p/${project.shareToken}`,
        };
      },
    }),
  };
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

  const origin = new URL(req.url).origin;

  const result = streamText({
    model: gateway.chatModel(modelId),
    system: await buildUserContext(sub, origin, balance),
    messages: await convertToModelMessages(trimmed),
    tools: buildTools(sub, origin, balance),
    // 允许"工具调用 → 拿到结果 → 继续回复"的多步循环;上限防失控
    stopWhen: stepCountIs(3),
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
