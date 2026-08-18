# 本地 Interfaze 聊天回写冒烟（按部就班）

目标：先用 **stub** 证明 Gateway 回写通，再关 stub 走 OpenClaw。

## 0. 本机已备（开发机）

| 项 | 期望 |
|---|---|
| Backend | `http://127.0.0.1:8000` healthy；`.env` 有 `INTERNAL_API_TOKEN` |
| Interfaze | `http://127.0.0.1:3010` |
| ACN CLI | `@acnlabs/acn-cli@0.14.1`（含 `--chat-writeback`） |
| 脚本 | `~/.config/comiclaw/{chat-complete,acn-to-openclaw-wake,chat-writeback}.sh` |
| 环境 | `~/.config/comiclaw/chat.env`（勿提交） |

```bash
# CLI（开发树）
cd /path/to/agentplanet/acn/clients/cli && npm run build && npm link
acn --version   # ≥ 0.14.1

# 脚本
# 脚本在私有仓 acnlabs/comiclaw-studio-host
install -m 755 /path/to/comiclaw-studio-host/scripts/chat-complete.sh ~/.config/comiclaw/chat-complete.sh
install -m 755 /path/to/comiclaw-studio-host/scripts/acn-to-openclaw-wake.sh ~/.config/comiclaw/acn-to-openclaw-wake.sh
```

## 1. Stub 冒烟（不碰 OpenClaw）

### 1a. 准备 Mode B agent（本机 listen）

`~/.acn/config.json` 需要 `api_key` + `agent_id`。若只有 `base_url`：

```bash
acn join --name "local-chat-smoke" --tags chat-smoke --relay
acn config get   # 记下 agent_id
echo "COMICLAW_ACN_AGENT_ID=<agent_id>" >> ~/.config/comiclaw/chat.env
```

### 1b. 启动 listen（stub）

```bash
set -a; source ~/.config/comiclaw/chat.env; set +a
# COMICLAW_CHAT_COMPLETE_STUB=1 必须开

acn listen --runtime command \
  --wake-exec "$HOME/.config/comiclaw/acn-to-openclaw-wake.sh" \
  --chat-writeback \
  --chat-api-base "$AGENTPLANET_API_BASE" \
  --chat-token "$AGENTPLANET_INTERNAL_TOKEN" \
  --chat-complete-exec "$HOME/.config/comiclaw/chat-complete.sh"
# 期望: [acn listen] connected … runtime=command
```

### 1c. Interfaze

1. 打开 `http://127.0.0.1:3010`，与该 online agent 建 1:1。  
2. 发一句任意中文。  
3. 先见 Delivered / Waiting；随后 agent 气泡为  
   `[stub] comiclaw received: …`  
4. listen stderr / `~/logs/comiclaw/acn-wake.log` 出现 `chat_writeback_ok`。

### 1d. 直连 Gateway（可选，不经 ACN）

若已有 `chat_id` 且 agent 已是参与者：

```bash
set -a; source ~/.config/comiclaw/chat.env; set +a
printf 'direct stub ok' | ~/.config/comiclaw/chat-writeback.sh "$CHAT_ID"
# 期望 HTTP 201
```

## 2. 关 stub，真 OpenClaw

前提：本机 OpenClaw `/hooks/agent` 支持 `waitForResult`；`hooks.token` 为真实 bearer。

```bash
# chat.env 中:
# COMICLAW_CHAT_COMPLETE_STUB=0   # 或删掉该行
# OPENCLAW_WAKE_URL=http://127.0.0.1:<port>/hooks/agent

# 重启 listen（同上命令），Interfaze 再发一句 → 真模型正文
```

失败且日志含 `status=accepted without result` → 升级 OpenClaw，勿回退到 LLM 自跑 writeback。

## 3. 生产 Comiclaw 宿主

把同一套 `chat.env` + `--chat-writeback` 接到生产 `acn listen` unit（见 `acn-listen-runtime-cutover.md`）。  
生产 `AGENTPLANET_API_BASE` 指向真实 Gateway，**不要**开 `COMICLAW_CHAT_COMPLETE_STUB`。

## 验收清单

- [ ] stub：Interfaze 出现 `[stub]` 气泡 + `chat_writeback_ok`  
- [ ] 真模型：气泡为正常回复（非 accepted）  
- [ ] 伪造 `agent_id` 回写 → `403 agent_not_participant`  
