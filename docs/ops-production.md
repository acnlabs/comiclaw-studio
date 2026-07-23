# ComicLaw 生产运维收口

面向**主 comiclaw 生产机**与 Studio 服务端。技能行为以 [`skills/comiclaw-studio/SKILL.md`](../skills/comiclaw-studio/SKILL.md) 为准；本文只收口部署、常驻进程、对账与验收。

## 角色与密钥

| 角色 | 机器 / 服务 | 密钥 | 技能包 |
|---|---|---|---|
| Studio 服务端 | Vercel / 自托管 Next | `STUDIO_API_KEY`、`ADMIN_KEY`、ACN chat 建单 key、价目与存储 | — |
| 主 comiclaw（官方生产 Agent） | OpenClaw 生产主机 | `STUDIO_API_KEY`（可选）和/或生产 ACN 身份；`STUDIO_BASE_URL` | `comiclaw-studio` 整目录 |
| 开放工人 | 任意 ACN agent | 仅自己的 `ACN_API_KEY` | `comiclaw-studio-worker` |

- 不要把 `STUDIO_API_KEY` 发给第三方工人。
- 生产任务走私有 subnet `comiclaw-internal`，`use_escrow=false`，不上 Org / 公开看板。

## 生产机必备状态

主 comiclaw 上确认：

1. **Skill 已同步**：`skills/comiclaw-studio/` 含 `SKILL.md`、`SKILL.zh-CN.md`、`scripts/studio.sh`、`scripts/production-worker.sh`（与仓库一致）。
2. **`acn` CLI 已登录为生产 Agent**（`ACN_PROD` / `ACN_PROD_AGENT_ID` 对应身份）。
3. **常驻 `acn listen`**（首选实时路径；无需公网入站端口）。
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

### Mode A — 常驻 `acn listen`（推荐）

```bash
acn listen
# 收到 invite / task_request →
./skills/comiclaw-studio/scripts/production-worker.sh handle <acnTaskId>
# 按 type 执行 → charge（如需）→ push →
acn tasks submit <acnTaskId> --result "..."
```

用 systemd / tmux / OpenClaw 进程监督保证进程掉线自动拉起。示例（systemd user unit 骨架）：

```ini
# ~/.config/systemd/user/acn-listen.service
[Unit]
Description=ACN realtime listen (comiclaw prod)
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/acn listen
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

### Mode B — 本地 A2A relay

若生产逻辑跑在本机 HTTP handler，用转发而不是裸 listen 消费：

```bash
acn listen --forward http://127.0.0.1:<local-a2a-port>
```

handler 收到 `task_request` / invite 后同样走 `handle` → accept → 干活 → submit。Mode B 仍要保证 **listen 进程常驻**；只是把事件转到本地端口。

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
- `AGENTPLANET_*` 与 `SERVICE_CHARGE_ALLOWLIST`（用量扣款）
- 价目 `PRICE_*`（charge 只传 `action`+`units`，金额服务端算）

建单默认 `includeDefaultWorker=true`（邀请主 comiclaw）；可额外传 `workerAgentIds`；`includeDefaultWorker=false` 时主 comiclaw 即使 accept 也不能写该项目（白名单以 metadata `worker_agent_ids` 为准）。

## 验收清单（smoke）

在**不烧真实上游**的前提下，按序勾选。

### A. 连通与身份

- [ ] `$S ping` → 2xx
- [ ] `acn` 当前身份 = 生产 Agent（与 Studio `ACN_PROD_AGENT_ID` 一致）
- [ ] `pgrep -af 'acn listen'`（或 systemd）显示常驻进程

### B. 默认邀请（主 comiclaw fallback）

- [ ] Studio/chat 建 `WRITE_SCRIPT` 或 `GENERATE_IMAGE`，不传 `workerAgentIds`（或仅默认）
- [ ] 主 comiclaw 经 listen 收到 invite（或 `reconcile` 能看到 open 任务）
- [ ] `handle <id>` 打印 `metadata.studio`；`accept` 成功
- [ ] 按 type 推送后 `submit`；Studio `get-acn-task` / 项目侧可见映射与交付物

### C. 多工人邀请

- [ ] 建单传 `workerAgentIds: [<open-worker>, …]` 且 `includeDefaultWorker: true`
- [ ] 主 comiclaw 与开放工人均在 `invited_agent_ids`
- [ ] **先 accept 者**成为执行方；另一方再 accept 失败或不再写

### D. `includeDefaultWorker=false`

- [ ] 仅邀请开放工人；主 comiclaw **不在**写白名单
- [ ] 主 comiclaw 即使误 accept，Studio 写接口应拒绝（非白名单）
- [ ] 开放工人用自己的 `ACN_API_KEY` + `X-Acn-Task-Id` 可写

### E. 扣款 / 402

- [ ] `GENERATE_IMAGE`：`charge` 先于上游出图；idempotency key = `comiclaw:gen:<acnTaskId>`
- [ ] 余额不足 → **402**，`studio.sh` 非零退出；**不得**调即梦；`submit` 带 `submitHint`
- [ ] 同 key 重试不重复扣（幂等）

### F. reconcile 兜底

- [ ] 停 listen 片刻，建一单，确认可能漏推
- [ ] 跑 `reconcile` 能列出该 open 任务
- [ ] 补 `handle` → accept → 完成 → 恢复 listen

## 日常运维速查

| 症状 | 先查 |
|---|---|
| 不接单 | `acn listen` 是否在跑；`reconcile` 是否有 open；subnet 是否 `comiclaw-internal` |
| `ping` 404 | `STUDIO_BASE_URL` 是否指向正式域，而非过期 preview |
| `ping` / 写接口 401 | `STUDIO_API_KEY` 或工人 ACN key；任务绑定头 |
| 出图前已烧上游 | 是否跳过了 `charge` 成功检查 |
| 主 comiclaw 写被拒 | 是否 `includeDefaultWorker=false` / 不在 `worker_agent_ids` |
| 开放工人要官方 key | 拒绝；指引 `comiclaw-studio-worker` |

## Skill 同步

官方机只同步 `skills/comiclaw-studio/` **整目录**：

- `SKILL.md` / `SKILL.zh-CN.md`
- `scripts/studio.sh`
- `scripts/production-worker.sh`

只拷 `SKILL.md`、空着 `scripts/` = **未完成同步**（`handle` / `reconcile` / `ping` 都不可用）。对外只发 `comiclaw-studio-worker`。同步后建议再跑一次 `$S ping` 与 `$W listen-hint`。

## 生产机实测摘录（comiclaw OpenClaw 主机）

核验时点：2026-07-23。路径：`~/.openclaw/workspace/skills/comiclaw-studio/`。

| 项 | 结果 |
|---|---|
| Skill 文档 | 曾只有 `SKILL.md`；已补齐 `SKILL.zh-CN.md` + `scripts/*` |
| `studio.sh ping` | OK（`AUTH_MODE=acn`，ACN CLI 身份） |
| `production-worker.sh reconcile` | OK；subnet 内可见历史 E2E `WRITE_SCRIPT` open 单 |
| `acn listen` | 在跑：`acn listen --forward http://127.0.0.1:8081`（OpenClaw gateway 子进程） |
| `:8081` | 曾无进程 → 实时 forward 黑洞；已加 user systemd `comiclaw-a2a-forward.service`（本地 stub 记日志，避免 relay 失败） |
| Agent 在线 | `acn agents me` 曾为 offline；`acn heartbeat` 后 online。已加 `acn-heartbeat.timer`（5 min） |
| 兜底 | 已加 `comiclaw-reconcile.timer`（10 min → `reconcile` 日志 `~/logs/comiclaw/reconcile.log`） |

### 主机 user systemd（已装）

```bash
systemctl --user status comiclaw-a2a-forward.service
systemctl --user status acn-heartbeat.timer comiclaw-reconcile.timer
# 日志
tail -f ~/logs/comiclaw/a2a-forward.log ~/logs/comiclaw/reconcile.log
```

说明：`:8081` stub **只保证 listen forward 不打空**；真正自动接单仍靠 OpenClaw 消费 A2A / 或人工·Agent 按 `handle` 执行。长期应用真实 A2A handler 替换 stub，或改为无 `--forward` 的 listen + Agent 侧消费。
