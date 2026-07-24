# ComicLaw 生产机切换：`acn listen --runtime`

**目标：** 去掉 `:8081` forward stub，改用 ACN CLI `0.14.0+` 内置 local receiver + 叫醒 OpenClaw。  
**前提：** [`@acnlabs/acn-cli@0.14.0`](https://www.npmjs.com/package/@acnlabs/acn-cli) 已发布（ACN [#191](https://github.com/acnlabs/ACN/pull/191) / tag `v0.15.5`）。  
**平台说明：** [`acn-local-receiver-rfc.md`](./acn-local-receiver-rfc.md)（已落地）；ACN 侧清单 [`acn-local-receiver-mvp.md`](https://github.com/acnlabs/ACN/blob/main/docs/features/acn-local-receiver-mvp.md)。

## 为何切换

| 现状（旧） | 问题 |
|---|---|
| `acn listen --forward http://127.0.0.1:8081` | CLI 只搬字节 |
| `comiclaw-a2a-forward.service` stub | 只防空端口，**不叫醒** OpenClaw |
| 任务仍 `open` | 只能靠 `reconcile` / 人工 `handle` |

| 新路径 | 行为 |
|---|---|
| `acn listen --runtime http --wake-url …` | CLI 自己回合法 A2A `accepted`，再 POST 规范化事件叫醒宿主 |
| `acn listen --runtime command --wake-exec …` | 同上，stdin 喂规范化 JSON；ComicLaw 用 `acn-to-openclaw-wake.sh` 转 OpenClaw hooks |
| 无本地 A2A 端口 | 不再依赖 `:8081` |
| wake 失败 | 打 `wake_failed` 并释放 dedupe，便于重推再叫醒 |

业务仍只负责：**被叫醒之后** `handle` → accept → 干活 → submit。

## 切换步骤（生产机）

### 0. 升级 CLI

```bash
npm i -g @acnlabs/acn-cli@0.14.0
acn --version   # 期望 ≥ 0.14.0
```

确认身份仍是生产 Agent（与 Studio `ACN_PROD_AGENT_ID` 一致）。

### 1. 确认 OpenClaw wake URL

常见形态（按本机 OpenClaw 实际端口 / token 改）：

```bash
# 示例 — 以本机 OpenClaw hooks 为准
export OPENCLAW_WAKE_URL='http://127.0.0.1:<openclaw-port>/hooks/agent'
export OPENCLAW_WAKE_HEADER='Authorization: Bearer <token>'
```

自检：对 wake URL 手动 `POST` 一小段 JSON，确认 OpenClaw 有反应（或至少 2xx）。

### 2. 停旧路径

```bash
# 停 listen（OpenClaw 子进程或 systemd，以实际为准）
systemctl --user stop comiclaw-a2a-forward.service 2>/dev/null || true
systemctl --user disable comiclaw-a2a-forward.service 2>/dev/null || true
pkill -f 'acn listen' || true
# 确认 :8081 不再被依赖
ss -ltnp | grep 8081 || true
```

### 3. 启用新 listen unit

写入 `~/.config/systemd/user/acn-listen.service`（或改现有 unit）：

```ini
[Unit]
Description=ACN Mode B listen (runtime wake → OpenClaw)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=%h
Environment=HOME=%h
# EnvironmentFile=%h/.config/comiclaw/acn.env
ExecStart=/usr/bin/env acn listen --runtime http \
  --wake-url http://127.0.0.1:OPENCLAW_PORT/hooks/agent \
  --wake-header Authorization: Bearer TOKEN
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

把 `OPENCLAW_PORT` / `TOKEN` 换成真实值（或改用 `EnvironmentFile` + `ExecStart` 读变量）。

```bash
systemctl --user daemon-reload
systemctl --user enable --now acn-listen.service
journalctl --user -u acn-listen.service -f
# 期望: [acn listen] connected as <agent_id> … (runtime=http)
```

### 4. 保持 heartbeat + reconcile

这两项**继续保留**（与 listen 正交）：

```bash
systemctl --user status acn-heartbeat.timer
systemctl --user status comiclaw-reconcile.timer
```

- heartbeat：避免 discovery `offline`
- reconcile：仍作漏推 / 重启兜底（`--runtime` **不**订阅纯 Task Pool list）

### 5. 验收

1. `pgrep -af 'acn listen'` → 含 `--runtime http`，**无** `--forward …8081`
2. Studio/chat 建一单（可小 `WRITE_SCRIPT`），数秒内 OpenClaw / 日志应被叫醒
3. journal 无持续 `wake_failed`；若有 → 查 wake URL / token
4. 故意停 OpenClaw 再推一次 → A2A 仍成功 + `wake_failed`；恢复后重推或 `reconcile` + `handle`
5. `$W handle <id>` → accept → 干活 → submit（业务路径不变）

## 回滚

```bash
systemctl --user stop acn-listen.service
# 临时恢复旧 forward（不推荐长期）
acn listen --forward http://127.0.0.1:8081
# 或重新 enable comiclaw-a2a-forward.service + 旧 listen 命令
```

## 覆盖边界（勿误解）

- `--runtime` 只处理 **经 Mode B relay 到达的 A2A**
- 从未推送、仅出现在 `acn tasks list` 的 open 任务 → 仍靠 `reconcile` / 人工
- `A2A accepted ≠ 已接单`：接单仍是 skill 里的 `accept` / `handle`

**Wake 桥接注意：** `--wake-exec` 脚本必须用环境变量/文件读 stdin 事件，**不要** `python3 <<'PY'` 吃掉管道 body（否则 `task_id=unknown`）。仓库脚本：`skills/comiclaw-studio/scripts/acn-to-openclaw-wake.sh`。

**已关闭（2026-07-24）：** ACN **0.15.6** 后，Studio `invite` 会 best-effort 推 A2A `task_request`；生产复测约 **1s 内** wake（不必先 `reconcile`）。缺陷记录见 [`acn-invite-no-a2a-defect.md`](./acn-invite-no-a2a-defect.md)。`reconcile` 仍作漏推/重启兜底。

## 参考

- 运维收口：[`ops-production.md`](./ops-production.md)
- ACN runbook：https://github.com/acnlabs/ACN/blob/main/docs/runbooks/acn-listen-heartbeat.md
- Skill：`skills/comiclaw-studio/`（`listen-hint` 已指向 `--runtime`）
