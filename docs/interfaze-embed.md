# Interfaze embed（ComicLaw 宿主）

权威契约：[AgentPlanet `docs/product/interfaze-embed-v0.md`](../../agentplanet/docs/product/interfaze-embed-v0.md)（P0 已实现）。本文只记 ComicLaw 怎么接。

## 链路

```
已登录用户
  → POST /api/user/chat/session  { agentId, context?, metadata, parentOrigin }
    → 校验用户 JWT（任意 agent 可聊；开地仍要自己认领的 agent）
  → POST {GATEWAY}/api/chat/embed/sessions
       Bearer 用户 JWT
       { agent_id, parent_origin, context?, metadata, locale, theme }
  ← { embed_url, chat_id, expires_at, expires_in }
  → <InterfazeChat /> 用 embed_url 开 iframe（token 在 hash，不要自己拼 ?token=）
```

`parent_origin` 是 **ComicLaw 页 origin**（如 `https://studio.comiclaw.acnlabs.org`），必须已在 Gateway 的 `embed_hosts` 表里。生产未列入会 `embed_origin_forbidden`。不要靠改 `INTERFAZE_EMBED_ALLOWED_ORIGINS` 接新宿主。

生产 Gateway（`https://api.agentplanet.org`，Railway `Agentplanet-backend`）现网已能读到 ComicLaw 种子行。公开核对：

`GET https://api.agentplanet.org/api/chat/embed/config` → `allowed_origins` 含 `https://studio.comiclaw.acnlabs.org` 和 `https://interfaze.io`。

新宿主走内部接口，不用改环境变量：

```http
POST https://api.agentplanet.org/api/chat/embed/hosts
X-Internal-Token: <INTERNAL_API_TOKEN>
{ "origin": "https://studio.example", "name": "Example" }
```

## 环境变量

```bash
# Chat Gateway（与 my-agents 同一基址；本地冒烟常用 http://127.0.0.1:8000）
AGENTPLANET_API_URL=https://api.agentplanet.org

# 官方助理 agent（Studio「Chat with comiclaw」以后用；空则只允许用户自己的 agent）
# NEXT_PUBLIC_COMICLAW_AGENT_ID=
```

iframe 的 `src` **以 Gateway 返回的 `embed_url` 为准**，不要用 Interfaze origin 自己拼 token。

## 业务页

```tsx
import InterfazeChat from "@/components/interfaze/InterfazeChat";

<InterfazeChat
  agentId={plot.ownerAgentId}
  metadata={{ plotId: plot.id, role: "steward" }}
/>
```

有 `workId` / `plotId` 时 BFF 会带 `context: "work:{id}"` 或 `"plot:{id}"`。同一部片子 / 地块刷新还在同一条会话；不传则仍是这个人和这个 agent 的全局 1:1。`metadata` 只给模型看，不参与选会话。

Play / 顶栏 comiclaw **先不挂**，等本地 iframe 冒烟通过。

## 本地冒烟（AgentPlanet 侧先过）

见 Interfaze 文档「本地冒烟」：`8000` + `3010` + `acn listen --chat-writeback`，空白 HTML 能聊通后，再配 `AGENTPLANET_API_URL=http://127.0.0.1:8000` 打开 ComicLaw 页挂组件。
