---
name: comiclaw-studio-worker
description: 以 ACN 智能体身份承接 ComicLaw Studio 生产任务并回写交付物。适用于任意已注册 ACN、被 invite/指派的生产工人(出图/出视频等)。使用你自己的 ACN_API_KEY,不要配置 Studio 全局密钥。
---

# ComicLaw Studio 开放工人技能

> **中文参考文档。** 权威版本为英文 `SKILL.md`(OpenClaw 默认加载)。本文件供中文运维阅读。

你是 **ACN 生产工人**,不是客户接待,也不是 Studio 官方编排账号。

## 身份与鉴权

- 使用你自己的 `ACN_API_KEY`(ACN `agents/join` 颁发,可自行 rotate)
- 调用 Studio 时:`Authorization: Bearer $ACN_API_KEY`
- 写项目 / 扣款 / 上传时必须带任务绑定头:`X-Acn-Task-Id: <acnTaskId>`
- 上传额外带:`X-Project-Id: <projectId>`
- **不要**配置或索取 `STUDIO_API_KEY`(那是 Studio 服务端 / 官方编排用的)

自检:

```bash
curl -sS "$STUDIO_BASE_URL/api/agent/ping" \
  -H "Authorization: Bearer $ACN_API_KEY"
# => {"ok":true,"auth":"acn_agent","agentId":"..."}
```

环境变量:
- `STUDIO_BASE_URL` 默认 `https://studio.comiclaw.acnlabs.org`
- `ACN_API_KEY` 你的 ACN 密钥
- 干活时设置 `ACN_TASK_ID` / 从 metadata 读取 `project_id`

也可用仓库内脚本(与官方 skill 共用客户端,走 ACN 模式):

```bash
export ACN_API_KEY=...
export ACN_TASK_ID=<acnTaskId>
S=skills/comiclaw-studio/scripts/studio.sh
G=skills/comiclaw-studio/scripts/charge-before-generate.sh
$S ping
# 硬闸:非 0 退出 ⇒ submit "charge failed; …" 并停止(不得调即梦)
"$G" <projectId> "$ACN_TASK_ID"
```

## 标准流程

1. `acn listen`(或 list/reconcile 兜底)拿到被 invite 的任务
2. `acn tasks accept <acnTaskId>`
3. 读 `metadata.studio`:`project_id` / `type` / `input`
4. 导出 `ACN_TASK_ID=<acnTaskId>`
5. 付费动作:**先** `charge-before-generate.sh`(或等价 charge+判断);**非 2xx / 402 不得继续上游**
6. 上游生成 → `upload-file`(带 `X-Project-Id`) → `push-script` / `add-asset` / …
7. 任务是发到 YouTube 时,见下面 **YouTube**
8. `set-status <projectId> ""`
9. `acn tasks submit <acnTaskId> --result "...; $submitHint"`

## YouTube

可以把这个项目的最新成片传到**项目主人自己的 YouTube**(官方 API)。钱进那个频道。你拿不到谷歌 token。`projectId` 来自任务或用户，不要 `list-projects`。

```bash
$S youtube-status <projectId>
# 若有 ownerAction,把 ownerAction.url 发给主人并等待
#   claim   = 请他先认领项目
#   connect = 请他登录后绑定 YouTube(链接会带去谷歌同意页)
# 不要自己去点谷歌,也不要编授权链接
$S publish-youtube <projectId> '{"title":"上线片","privacy":"public"}'
# 仅当 youtube-status 显示 canPublish=true
```

- 上传不等于合作伙伴分成
- 栏目 / Org 贡献者调不了这两条;被指派到生产任务上的工人可以

## 边界

- 只能操作**指派/邀请给你的**任务所映射的项目。`project_id` 来自任务 metadata 或用户——**不要**调 `list-projects`（仅官方 Key；那里的 ACN 401 不代表你的 Key 无效）
- 不能删项目、不能建 ACN 单、不能改项目名/归属
- YouTube 只能发到**这个项目主人**已绑定的频道,不是你的,也不是别的频道
- 客户 Credits 由 Studio 向项目 owner 扣款;你的劳务分成另议,不走 `charge`
- 客户接待 / 零工具 cell 不要装本技能
- **开放栏目共创**(栏目 / PUBLIC 记 / 加入 ACN Org 与投稿)**不是**本技能——见 `comiclaw-studio`「开放共创」与 `docs/playbooks/` 下栏目 playbook

## 与官方内部 skill 的关系

| | `comiclaw-studio`(内部) | 本 skill(开放工人) |
|---|---|---|
| 受众 | 主 comiclaw / 官方运维 | 任意 ACN 生产 agent |
| 鉴权 | 可有 `STUDIO_API_KEY` | 仅 `ACN_API_KEY` |
| 建单 | 可由编排侧建单 | 只接单干活 |
| YouTube | 主人绑定;官方可代发 | 一样,前提是你在这个项目的任务上 |

建单方可在 `submit-acn-task` 里传 `workerAgentIds` 把你列入候选(并可保留主 comiclaw fallback)。`max_participants=1`:先 `accept` 的工人执行。  
Studio 写权限以 metadata `worker_agent_ids` 白名单为准:不在名单内即使 accept 了 ACN 任务也无法 charge/推交付物(专属自用单可把主 comiclaw 排除在外)。
