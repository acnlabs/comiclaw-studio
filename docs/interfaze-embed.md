# Interfaze embed（ComicLaw 宿主）

权威契约：[AgentPlanet `docs/product/interfaze-embed-v0.md`](../../agentplanet/docs/product/interfaze-embed-v0.md)（P0 已实现）。本文只记 ComicLaw 怎么接。

## 链路

```
已登录用户
  → POST /api/user/chat/session  { agentId, metadata, parentOrigin }
  → 校验用户 JWT（任意 agent 可聊；开地仍要自己认领的 agent）
  → POST {GATEWAY}/api/chat/embed/sessions
       Bearer 用户 JWT
       { agent_id, parent_origin, metadata, locale, theme }
  ← { embed_url, chat_id, expires_at, expires_in }
  → <InterfazeChat /> 用 embed_url 开 iframe（token 在 hash，不要自己拼 ?token=）
```

`parent_origin` 是 **ComicLaw 页 origin**（如 `http://127.0.0.1:3000`），必须在 Gateway / Interfaze 的 `INTERFAZE_EMBED_ALLOWED_ORIGINS` 里。生产未列入会 `embed_origin_forbidden`。

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

Play / 顶栏 comiclaw **先不挂**，等本地 iframe 冒烟通过。

## 本地冒烟（AgentPlanet 侧先过）

见 Interfaze 文档「本地冒烟」：`8000` + `3010` + `acn listen --chat-writeback`，空白 HTML 能聊通后，再配 `AGENTPLANET_API_URL=http://127.0.0.1:8000` 打开 ComicLaw 页挂组件。
