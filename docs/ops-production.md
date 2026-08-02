# ComicLaw 生产运维收口

面向**主 comiclaw 生产机**与 Studio 服务端。技能行为以 [`skills/comiclaw-studio/SKILL.md`](../skills/comiclaw-studio/SKILL.md) 为准；本文只收口部署、常驻进程、对账与验收。

## Invite → Wake → Handle（生产 ACN ≥ 0.15.6）

Studio 以 **`comiclaw-studio`** agent（`ACN_CHAT_*`）建单并 `invite` 后，ACN 会 **best-effort** 推 A2A `task_request`；工人 `acn listen --runtime …` 应在数秒内 wake，Agent 再 `handle` → `accept` → 干活 → `submit`。**不应**把 `comiclaw reconcile` 当作主路径。ACN 已废止 `system:task-invite`。

生产机 wake 桥接脚本：[`skills/comiclaw-studio/scripts/acn-to-openclaw-wake.sh`](../skills/comiclaw-studio/scripts/acn-to-openclaw-wake.sh)（安装到 `~/.config/comiclaw/`，供 `--wake-exec` 使用）。需 `~/.config/comiclaw/hooks.token`（或 `COMICLAW_HOOKS_TOKEN_FILE`）。**禁止** `printf … | python3 <<'PY'`——heredoc 会吞掉 stdin，导致 `task_id=unknown`，Agent 误用 OpenClaw Job ID。仅接受 UUID `task_id`；`acn-wake.log` 只记结构化字段（无 brief / 响应体）。

闭环验收（2026-07-24）：task `5b6642fa-…` invite `10:48:47Z` → wake `10:48:48Z`（`parsed_task_id` 正确）→ ~2min 内 `completed` + `push-script`。invite→A2A 缺陷见 [`acn-invite-no-a2a-defect.md`](./acn-invite-no-a2a-defect.md)。

完整归档见 [`ops-acceptance-2026-07-24.md`](./ops-acceptance-2026-07-24.md)。

GENERATE_IMAGE 闭环（2026-07-24）：task `2b94a6b0-…` wake 后约 6min `completed`；`assetId=cmryutvi40003jp04yzpwptmx` + Vercel Blob `imageUrl`。主路径仍是 invite→A2A→`--runtime` wake→自主 charge/出图/submit。

## 角色与密钥

| 角色 | 机器 / 服务 | 密钥 | 技能包 |
|---|---|---|---|
| Studio 服务端 | Vercel / 自托管 Next | `STUDIO_API_KEY`、`ADMIN_KEY`、**comiclaw-studio** 建单 key（`ACN_CHAT_*`）、价目与存储 | — |
| 主 comiclaw（官方生产 Agent） | OpenClaw 生产主机 | `STUDIO_API_KEY`（可选）和/或生产 ACN 身份；`STUDIO_BASE_URL` | `comiclaw-studio` 整目录 |
| 开放工人 | 任意 ACN agent | 仅自己的 `ACN_API_KEY` | `comiclaw-studio-worker` |

- 不要把 `STUDIO_API_KEY` 发给第三方工人。
- 生产任务走私有 subnet `comiclaw-internal`，`use_escrow=false`，不上 Org / 公开看板。

## 派单定案（谁可叫主 comiclaw）

| 路径 | 是否采用 |
|---|---|
| Studio / chat → 服务端 **`comiclaw-studio`**（`ACN_CHAT_*`）建单并 invite 主 comiclaw | **是（唯一主路径）** |
| 客户 cell agent 直调 ACN 建单并 invite 主 comiclaw | **否** |
| 人类 ID + `system:task-invite` | **否**（ACN 已废止） |

客户 cell：**零生产工具、零 ACN/Studio 生产密钥**；人类在 Studio/chat 确认生产后，由 `comiclaw-studio` 代建并推给主工人。`metadata.studio.owner_user_id` 只表业务归属，不是 ACN creator。开放工人可被 `workerAgentIds` 额外 invite，但仍由 **comiclaw-studio** 发起。

## 生产机必备状态

主 comiclaw 上确认：

1. **Skill 已同步**：`skills/comiclaw-studio/` 含 `SKILL.md`、`SKILL.zh-CN.md`、`scripts/studio.sh`、`scripts/production-worker.sh`、`scripts/charge-before-generate.sh`、`scripts/acn-to-openclaw-wake.sh`（与仓库一致；wake 脚本另装到 `~/.config/comiclaw/`）。
2. **`acn` CLI 已登录为生产 Agent**（`ACN_PROD` / `ACN_PROD_AGENT_ID` 对应身份）。
3. **常驻 `acn listen --runtime …`**（CLI ≥ 0.14.0；首选实时路径；无需公网入站端口）。切换说明见 [`acn-listen-runtime-cutover.md`](./acn-listen-runtime-cutover.md)。
4. **环境变量**（skill / shell profile / OpenClaw skill config）：

```bash
export STUDIO_BASE_URL=https://studio.comiclaw.acnlabs.org
export STUDIO_API_KEY=...          # 官方编排；也可用生产 ACN + 任务绑定
export ACN_SUBNET_SLUG=comiclaw-internal
# acn CLI 自身登录态另配；勿把开放工人的 key 写进官方 skill
```

自检：

```bash
S=skills/comiclaw-studio/scripts/studio.sh
W=skills/comiclaw-studio/scripts/production-worker.sh
$S ping
$W listen-hint
```

## 接单形态

### 推荐 — `acn listen --runtime`（CLI ≥ 0.14.0）

ACN 内置 A2A 应答 + 叫醒本机 OpenClaw（**不**再绑 `:8081` forward stub）：

```bash
acn listen --runtime http \
  --wake-url http://127.0.0.1:<openclaw-port>/hooks/agent \
  --wake-header 'Authorization: Bearer …'
# 收到 wake / invite / task_request →
./skills/comiclaw-studio/scripts/production-worker.sh handle <acnTaskId>
# 按 type 执行 → charge（如需）→ push →
acn tasks submit <acnTaskId> --result "..."
```

用 systemd / tmux / OpenClaw 进程监督保证进程掉线自动拉起。完整切换步骤与验收见 [`acn-listen-runtime-cutover.md`](./acn-listen-runtime-cutover.md)。骨架：

```ini
# ~/.config/systemd/user/acn-listen.service
[Unit]
Description=ACN Mode B listen (runtime wake → OpenClaw)
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env acn listen --runtime http --wake-url http://127.0.0.1:PORT/hooks/agent --wake-header Authorization: Bearer TOKEN
Restart=always
RestartSec=5
Environment=HOME=%h
# EnvironmentFile=%h/.config/comiclaw/acn.env

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now acn-listen.service
```

与 `acn-heartbeat.timer` **同生命周期**（listen 在跑但 discovery 仍可能 offline）。

### 兼容 — `--forward`（不推荐生产）

仅当你自备本机 A2A 服务且能保证端口常有合法 JSON-RPC 应答时：

```bash
acn listen --forward http://127.0.0.1:<local-a2a-port>
```

**不要**再依赖「空端口 + stub 只记日志」——那只防 relay 失败，不叫醒 Agent。生产请用上一节 `--runtime`。

### 兜底 — `reconcile`

漏推、重启后、或怀疑 listen 断过时：

```bash
./skills/comiclaw-studio/scripts/production-worker.sh reconcile
# 建议每 5–15 分钟或开机后跑一次（cron / OpenClaw 定时均可）
```

`reconcile` **不能**替代 listen；它只列出本 subnet 的 open 任务供人工/Agent 补处理。

## Studio 服务端（对照）

见仓库根目录 [`.env.example`](../.env.example)。生产至少核对：

- `ACN_API_URL` / `ACN_CHAT_AGENT_ID` / `ACN_CHAT_API_KEY` / `ACN_PROD_AGENT_ID` / `ACN_SUBNET_SLUG`  
  - **建单身份固定 comiclaw-studio**：`ACN_CHAT_API_KEY` 必须是该已注册 agent 的 key；`ACN_CHAT_AGENT_ID` 为其 agent_id（生产 `90f884c1-…`）。ACN 已废止 `system:task-invite`，勿用人类 ID 建单。
- `AGENTPLANET_*` 与 `SERVICE_CHARGE_ALLOWLIST`（用量扣款）
  - `CHARGE_PAYEE_AGENT_ID` = 本 Studio 收款 Agent（生产 `90f884c1-…` = comiclaw-studio）；`AGENTPLANET_CHARGE_SOURCE=comiclaw-studio`（source 字符串，不是 UUID）。默认展示名 `comiclaw` 会 502 `Agent not found`；旧名 `AGENTPLANET_AGENT_ID` 仍兼容
- 价目 `PRICE_*`（charge 只传 `action`+`units`，金额服务端算）

建单默认 `includeDefaultWorker=true`（邀请主 comiclaw）；可额外传 `workerAgentIds`；`includeDefaultWorker=false` 时主 comiclaw 即使 accept 也不能写该项目（白名单以 metadata `worker_agent_ids` 为准）。

## 「为你推荐」的排序与官方推荐位

首页排序在 [`src/lib/feedRanking.ts`](../src/lib/feedRanking.ts),分三档:

1. **官方推荐**(`Work.featuredAt` 在 72 小时内)
2. **新发布**(24 小时内),按发布时间倒序
3. **其余**按最近 48 小时的真实播放数排,再以发布时间兜底

第二档不是可选的。只按热度排会把每个新作品永久埋掉——它从零播放开始,于是永远拿不到能让它上升的曝光。

置顶 / 取消置顶(浏览器里用 `ADMIN_KEY` 登录后同源调用):

```bash
curl -sS -X POST "$STUDIO_BASE_URL/api/admin/works/<workId>/feature" \
  -H "Content-Type: application/json" -b "studio_admin=$ADMIN_KEY" \
  -d '{"featured":true}'
```

推荐位**会自己过期**(72 小时),不需要有人记着回来撤。要提前撤就传 `{"featured":false}`。

播放记录走 `POST /api/feed/plays`,由前端在一条视频真正停留 3 秒后上报。它按 `(作品, 匿名会话, 小时)` 唯一去重,所以循环播放和来回滚动刷不出热度。会话标识只是一个 HttpOnly cookie,不关联账号。

**热度不是可信计数,只是个排序信号,别拿它对外报数。** cookie 由调用方决定发不发,所以还按来源网络的加盐哈希封顶(每作品每网络每小时 5 次)。这挡住了「一台机器不带 cookie 刷」,但**换 IP 就能绕过**——彻底解决要么只统计登录用户(等于放弃大部分数据),要么上专门的风控。目前不做,因为影响面小:排序的前两档是官方推荐与新发布,刷高热度最多让一个作品在**旧内容之间**往前排,拿不到首页顶部。

**个性化(「这个人爱看什么」)还没做**,现在记的数据是它的前提,不是它本身。

## 只有生产能写外部系统

Vercel 默认把环境变量发给所有部署,所以**任何分支的 preview 都握着生产的 ACN key 与 AgentPlanet 内部令牌**。这不是假设:实测用一个 PR 的 preview 地址,能以 `comiclaw-studio` 的身份读写线上 Org。

代码侧已经堵住:[`src/lib/externalWrites.ts`](../src/lib/externalWrites.ts) 在 `acnFetch` / `orgFetch` / `storeFetch` 三个出口拦下非生产部署的**写**操作(读放行,preview 不能读就没法审;读也动不了钱和成员)。本地与 CI 没有 `VERCEL_ENV`,不受影响。

**代码只能兜住我们自己的调用路径,凭证本身仍然发给了 preview。** 要真正隔断,在 Vercel 控制台把这几项的作用域改成只 Production:

| 变量 | Preview 应给什么 |
|---|---|
| `ACN_CHAT_API_KEY` | 留空,或另注册一个测试 agent 的 key |
| `AGENTPLANET_INTERNAL_TOKEN` | 留空,或测试令牌 |
| `DATABASE_URL` | **不能留空**——preview 需要库。要给一份影子库,见下一节 |

数据库这半也在代码里兜住了:非生产部署若没有声明自己有影子库,Prisma 的写操作一律抛错(读放行)。给 Preview 接上独立的 `DATABASE_URL` 之后,在 Preview 环境加一个 `PREVIEW_DATABASE_IS_SHADOW=1`,写就恢复——写进它自己那份拷贝。

## 数据库迁移只在生产部署时跑

Preview 与生产**共用同一个数据库**。构建命令又是同一条，所以在加保护之前，任何分支只要一推上去，preview 构建里的 `prisma migrate deploy` 就会立刻改动生产库——在 PR 被审、被合之前。加可空字段无所谓，但一个删列、改名或加 `NOT NULL` 的迁移会在 PR 还开着的时候把生产打挂。

现在 `vercel-build` 走 [`scripts/migrate-on-production.mjs`](../scripts/migrate-on-production.mjs)：`VERCEL_ENV=production` 才执行迁移，preview 与 development 跳过并打印原因。迁移失败会返回非零、中断构建，不会静默放行。

代价要知道：**带新迁移的分支，它自己的 preview 会因为库还没迁而报错**，直到合并。这是有意的取舍——preview 挂是这个分支自己的事，生产挂是所有人的事。

要让 preview 也能验迁移，得给 Vercel 的 Preview 环境单独配一个 `DATABASE_URL`（指向一份影子库）。那一步在 Vercel 控制台，不在代码里。

## 验收清单（smoke）

在**不烧真实上游**的前提下，按序勾选。

### A. 连通与身份

- [x] 生产 Studio API 可达（本轮以 `STUDIO_API_KEY` 建单/验收；官方机 skill 宜配 key 或 ACN 身份以便 `$S ping`）
- [x] `acn` 当前身份 = 生产 Agent（Comiclaw `cd7ec18a-…`，与 `ACN_PROD_AGENT_ID` 一致）
- [x] `acn-listen.service` active：`--runtime command --wake-exec`（非裸 `--forward :8081`）

### B. 默认邀请（主 comiclaw fallback）

- [x] Studio/chat 建 `WRITE_SCRIPT` 或 `GENERATE_IMAGE`，不传 `workerAgentIds`（或仅默认）
- [x] 主 comiclaw 经 listen **数秒内 wake**（ACN ≥ 0.15.6；`acn-wake.log` 中 `parsed_task_id` 非空；不必先靠 `reconcile`）
- [x] Agent **自主** `handle` → `accept`（勿把 OpenClaw Job ID 当 task id）
- [x] 按 type 推送后 `submit`；任务 `completed`；Studio 项目侧可见交付物

### C. 多工人邀请

- [x] 建单传 `workerAgentIds: [<open-worker>, …]` 且 `includeDefaultWorker: true`（2026-07-24：双 invite 列表正确）
- [x] 主 comiclaw 与开放工人均在 `invited_agent_ids` / `worker_agent_ids`
- [x] **先 accept 者**成为执行方；另一方再 accept → **400**（2026-07-25：`cursor-acn-dev` ↔ 主 comiclaw；双向均验）

### D. `includeDefaultWorker=false`

- [x] 仅邀请开放工人；主 comiclaw **不在**写白名单（task `24e1eb48-…`）
- [x] 主 comiclaw 非白名单时 Studio 写 → **403** `not invited/assigned`
- [x] 开放工人用自己的 `ACN_API_KEY` + `X-Acn-Task-Id` 可写（2026-07-25：`cursor-acn-dev`；主工人非白名单仍 403）

### E. 扣款 / 402

- [x] `POST /charge` units=1 → **201 SUCCESS**（2026-07-25：owner `github\|43027886`；收款方 `CHARGE_PAYEE_AGENT_ID=90f884c1-…`）
- [x] 余额不足 → **402**，`studio.sh` exit 22 + `submitHint`；余额不扣（`units=1000` quote 5000）
- [x] 同 key 重试 → **200** `idempotent=true`，不重复扣
- [x] 出图前硬闸：`charge-before-generate.sh` 非 2xx → exit 非 0 + `CHARGE_FAILED`（2026-07-25：502 无钱包 / 402 大额；幂等 SUCCESS → 0）
- [x] 生产机 skill 已同步并冒烟：`~/.openclaw/workspace/skills/comiclaw-studio/scripts/charge-before-generate.sh` → 402 `CHARGE_FAILED`（2026-07-25）

### F. reconcile 兜底

- [x] 停 listen 后建单漏推（2026-07-25：task `ebdca4f0-…` 保持 open）
- [x] `production-worker.sh reconcile` 列出该 open 任务
- [x] `accept` → `submit --result` → **completed** → 恢复 `acn-listen` **active**

## 日常运维速查

| 症状 | 先查 |
|---|---|
| 不接单 | `acn listen --runtime` 是否在跑；journal 有无 `wake_failed`；`reconcile` 是否有 open；subnet 是否 `comiclaw-internal` |
| `ping` 404 | `STUDIO_BASE_URL` 是否指向正式域，而非过期 preview |
| `ping` / 写接口 401 | `STUDIO_API_KEY` 或工人 ACN key；任务绑定头 |
| 出图前已烧上游 | 是否跳过了 `charge` **2xx** 检查（含 402/502） |
| charge 502 `Agent not found` | Vercel `CHARGE_PAYEE_AGENT_ID` 是否为 comiclaw-studio UUID `90f884c1-…`（勿填展示名）；allowlist `comiclaw-studio:<payee-uuid>` |
| charge 502 `Wallet not found` | 项目 `ownerUserId` 在 AgentPlanet 是否已有钱包（e2e 探针无钱包属预期） |
| 开放工人 `not_subnet_member` | 用 `STUDIO_API_KEY` 调 `POST /api/admin/acn/subnet-invite`（slug=`comiclaw-internal`）批准入网 |
| 冒烟残留 open 单 | `POST /api/admin/acn/tasks/cancel`（creator=`comiclaw-studio`） |
| 主 comiclaw 写被拒 | 是否 `includeDefaultWorker=false` / 不在 `worker_agent_ids` |
| 开放工人要官方 key | 拒绝；指引 `comiclaw-studio-worker` |

## Skill 同步

官方机只同步 `skills/comiclaw-studio/` **整目录**：

- `SKILL.md` / `SKILL.zh-CN.md`
- `scripts/studio.sh`
- `scripts/production-worker.sh`
- `scripts/acn-to-openclaw-wake.sh`（另装到 `~/.config/comiclaw/`）

只拷 `SKILL.md`、空着 `scripts/` = **未完成同步**（`handle` / `reconcile` / `ping` 都不可用）。对外只发 `comiclaw-studio-worker`。同步后建议再跑一次 `$S ping` 与 `$W listen-hint`。

## 生产机实测摘录（comiclaw OpenClaw 主机）

核验时点：2026-07-24。路径：`~/.openclaw/workspace/skills/comiclaw-studio/`。完整归档：[`ops-acceptance-2026-07-24.md`](./ops-acceptance-2026-07-24.md)。

| 项 | 结果 |
|---|---|
| Skill | 与 main 对齐：`SKILL.md` / `SKILL.zh-CN.md` / `scripts/{studio,production-worker,acn-to-openclaw-wake}.sh` |
| `acn listen` | `acn-listen.service`：**`--runtime command --wake-exec`** |
| 闭环 | WRITE_SCRIPT + GENERATE_IMAGE 均自主 `completed`（见归档） |
| `reconcile` | `open_in_subnet=0`（已 cancel 历史 `[WAKE_PROBE]`） |
| Agent 在线 | `acn-heartbeat.timer`（5 min）保留 |
| 兜底 | `comiclaw-reconcile.timer`（10 min）保留 |

### 主机 user systemd

```bash
systemctl --user status acn-listen.service          # --runtime command --wake-exec …
systemctl --user status acn-heartbeat.timer comiclaw-reconcile.timer
# 旧 stub（切换后应 inactive）:
# systemctl --user status comiclaw-a2a-forward.service
journalctl --user -u acn-listen.service -f
```

**平台：** ACN CLI `0.14.0` 已提供 `--runtime`（[#191](https://github.com/acnlabs/ACN/pull/191)）。ComicLaw 侧切换步骤见 [`acn-listen-runtime-cutover.md`](./acn-listen-runtime-cutover.md)；原 RFC [`acn-local-receiver-rfc.md`](./acn-local-receiver-rfc.md) 标为已落地。

---

## 栏目治理：认领、开闸、日更定时

《AI 漫记》这类官方栏目由 Studio key 代建，**默认无主**（`ownerUserId` 为空），
且 `contributePolicy=org_members`（投稿前要有人在 `/studio/org-joins` 批准）。
栏目一直没有第二记，很大程度上就是因为这两件事没人做。

三条命令都在 **comiclaw 生产机**上跑——`STUDIO_API_KEY` 本来就配在那儿，
不必把密钥复制到别处。

```bash
BASE=https://studio.comiclaw.acnlabs.org
KEY=$STUDIO_API_KEY            # 生产机上已有

# 0. 拿栏目 id（顺便看当前策略与归属）
curl -sS "$BASE/api/agent/columns" -H "Authorization: Bearer $KEY" \
  | python3 -c 'import json,sys;[print(c["slug"], c["id"], c["contributePolicy"], c.get("ownerUserId") or "无主") for c in json.load(sys.stdin)["columns"]]'

# 1. 认领给某个人（栏目治理：改名、审批入 Org 申请）
curl -sS -X PATCH "$BASE/api/agent/columns/<栏目 id>" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"ownerUserId":"<Auth0 sub>"}'

# 2. 开闸：任何 ACN agent 都能投稿，不必先入 Org
curl -sS -X PATCH "$BASE/api/agent/columns/<栏目 id>" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"contributePolicy":"open"}'

# 3. 指定编辑 agent：它此后能用自己的 ACN 身份开一记，不必持有本 key
curl -sS -X PATCH "$BASE/api/agent/columns/<栏目 id>" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"editorAgentId":"<编辑 agent 的 ACN agent_id>"}'
```

这三条是**一次性**的。配完之后日更由编辑 agent 自己跑，不再需要这把 key。

再跑一次第 0 步确认 `ownerUserId` 与策略都变了。

### 怎么拿到自己的 Auth0 sub

系统里目前没有地方显示它。登录 comiclaw 后，浏览器控制台执行：

```js
Object.keys(localStorage).filter(k => k.startsWith("@@auth0spajs@@"))
  .map(k => { try { return JSON.parse(localStorage[k])?.body?.decodedToken?.user?.sub } catch {} })
  .filter(Boolean)[0]
```

输出形如 `auth0|xxxxxxxx`。

### 日更定时放在这台机器上，不在 Studio

Studio 是记录系统，不该拿闹钟指挥编辑何时出刊；而且"选一个全球 AI 热点"是
判断不是调度——定时器只能开个空记再命令 agent 填。

comiclaw 就跑在这台机器上（OpenClaw + `acn listen`），所以定时也放这里：
每天 wake 一次，它醒来后自己决定发不发、发什么，再自己调 Studio 开记与写稿
（动作见 `playbooks/ai-journal.md`）。

**先手动 wake 一次看它能否闭环，再加 crontab。** 给一个没跑通过的循环上定时器，
只是每天定时失败一次——而且失败是静默的。
