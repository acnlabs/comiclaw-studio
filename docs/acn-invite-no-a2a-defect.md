# ACN 缺陷：Task Pool invite 未经 Mode B A2A 推送（ComicLaw 复现）

**状态：** ACN 已修 / 待验收（部署后）  
**严重度：** 阻断生产「invite → 工人自主执行」闭环  
**环境：** ACN global `api.acnlabs.dev`；工人 CLI `@acnlabs/acn-cli@0.14.0`；`acn listen --runtime command`  
**关联：** [acn-listen-runtime-cutover.md](./acn-listen-runtime-cutover.md)、ACN #191 / local receiver MVP、[ACN #198](https://github.com/acnlabs/ACN/pull/198)

## 修复进展（ACN）

- **已合并：** [ACN #198](https://github.com/acnlabs/ACN/pull/198) — `invite` 写白名单后 best-effort 推送 A2A `task_request`（Mode A/B/inbox）；webhook `task.invited`；非 agent 邀请人过渡用 `system:task-invite`。
- **待做：** ACN 生产部署后，按下方验收清单复测；通过后把状态改为 **已关闭**。
- **验收：**
  1. 工人 `acn listen --runtime …` 在线  
  2. Studio 建单并 invite 该工人  
  3. 数秒内 wake（无需 `reconcile`）  
  4. 离线 invitee 可进 inbox；白名单仍写入  

## 期望

Studio（建单账号 `comiclaw-studio`）在 private subnet `comiclaw-internal` 内：

1. `POST /tasks` 创建生产任务（`use_escrow=false`）
2. `invite` 主 comiclaw（Mode B，常驻 `acn listen --runtime …`）
3. **工人本机 listen 立即收到可唤醒的 A2A（如 `task_request`）**
4. CLI `--runtime` 叫醒宿主 Agent → Agent 自主 `accept` / 干活 / `submit`

## 实际

| 步骤 | 结果 |
|---|---|
| Studio `POST /api/agent/projects/{id}/acn-tasks` | **201**；`inviteeIds` 含主 comiclaw；`inviteErrors=[]` |
| Task Pool | 任务 `open`；`invited_agent_ids` 含工人；`metadata.studio` 完整 |
| 工人 `acn listen --runtime command` | WebSocket **已连接**（有 reconnect 日志，无 inbound 业务帧） |
| `~/logs/comiclaw/acn-wake.log` | **无新 wake**（手动模拟事件可 200 叫醒 OpenClaw） |
| `acn notify list` / `acn inbox list` | **空** |
| `reconcile` | **能列出**该 open 任务 |

结论：**invite 写进了 Task Pool，但没有变成 Mode B relay 上的 A2A（也未进 notify/inbox）。**  
因此「CLI 已具备 `--runtime`」≠「invite 能自主接单」。工人只能靠轮询/`reconcile` 兜底——不满足业务闭环。

## 复现（2026-07-24）

1. 工人：`acn listen --runtime command --wake-exec <wake-to-openclaw>`（online + connected）
2. Studio（生产 key）建项目并：

```http
POST /api/agent/projects/{projectId}/acn-tasks
{ "type": "WRITE_SCRIPT", "input": { "brief": "…", "title": "…" }, "includeDefaultWorker": true }
```

3. 示例任务：`40c6d679-26e2-42f5-b4c7-033c56909532`  
   - creator: `comiclaw-studio` (`90f884c1-…`)  
   - invitee / worker: Comiclaw (`cd7ec18a-…`)  
   - subnet: `comiclaw-internal`
4. 观察 ≥30s：listen journal 无 inbound；wake 日志无新行；notify/inbox 空

对照：向 wake-exec **手动喂**同结构事件 → OpenClaw `/hooks/agent` **200**。宿主与 CLI runtime **正常**；缺口在 **invite → 推送**。

## 请 ACN 确认

1. Task Pool `invite` 是否保证对 Mode B（`delivery=relay` + 活跃 `listen`）工人发送 **A2A**？  
2. 若否：官方实时接单路径是什么（A2A / notify / inbox / 仅 list）？文档与 CLI 是否一致？  
3. 若应推而未推：是 relay 漏推、invite 未挂 delivery，还是 subnet/内部任务被跳过？  
4. 修复后的验收：invite 后数秒内 `acn listen --runtime` 触发 wake（或等价 inbound），无需 `tasks list`。

## Mode A 能否绕过？

**不必然。**

| 若根因是… | Mode A（公网 `https://…/a2a`） |
|---|---|
| invite **根本不发** A2A/通知 | **仍失败**（直连也没请求） |
| invite **会发** A2A，但 Mode B relay/`listen` 未投递 | **可能修好**（ACN 对 endpoint POST） |

ComicLaw 现状更像第一种或「未对 Task invite 挂 delivery」：Pool 已 invite，listen/notify/inbox 皆静默。  
上 Mode A 前仍需 ACN 明确：**invite 是否产生 A2A**。有公网 HTTPS A2A 只解决运输形态，不自动补「未发出的事件」。

在确认 invite→A2A 之前，ComicLaw **保持** Mode B + `--runtime` + `reconcile` 兜底；不把切 Mode A 当作本缺陷的默认修复。

## 非本缺陷

- OpenClaw hooks / wake-exec（手动事件可叫醒）
- Studio 建单/映射（201 + `AcnTaskRef` + `metadata.studio`）
- CLI `--runtime` 接收器本身（ACN #191 已落地）
