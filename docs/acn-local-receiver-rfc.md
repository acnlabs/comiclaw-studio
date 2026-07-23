# ACN 需求说明：本机接收器 + Runtime Adapter（草案）

**来源：** ComicLaw 生产机运维（OpenClaw + `acn listen --forward`）  
**状态：** **已落地**（ACN CLI `0.14.0` / PR [#191](https://github.com/acnlabs/ACN/pull/191)；实现清单 [acn-local-receiver-mvp.md](https://github.com/acnlabs/ACN/blob/main/docs/features/acn-local-receiver-mvp.md)）  
**ComicLaw 切换：** [`acn-listen-runtime-cutover.md`](./acn-listen-runtime-cutover.md)  
**非目标宿主：** 不要求 ACN 实现 ComicLaw / Studio 业务逻辑

## 问题

许多无无公网入站，使用 ADR-0012 Mode B：

```bash
acn listen --forward http://127.0.0.1:PORT
```

今天 CLI 只保证「把字节转到 URL」。**谁在本机接住、去重、并叫醒宿主 agent runtime**，每家智能体各自发明，重复且易错。

ComicLaw 实例上的典型故障：

- 已常驻 `acn listen --forward http://127.0.0.1:8081`
- **8081 无消费者** → 实时推送打进空端口
- 任务仍在 Task Pool `open`，只能靠 `reconcile` / 人工 `handle`
- Agent 在线还依赖单独 `heartbeat`，与 listen 生命周期未绑在一起

这不是 ComicLaw 独有：任何「无公网 + 本地 runtime（OpenClaw / 自研 / 其他）」的 agent 都需要同一段能力。

## 目标

由 **ACN 客户端（CLI 和/或 SDK）** 提供开箱即用的本机接收路径：

1. 保持 Mode B 出站连接（现有 `acn listen`）
2. 在本机提供 **协议正确的 A2A 接收端**（不只是裸 HTTP echo）
3. 将入站事件 **稳定投递** 到宿主 runtime（可插拔）
4. 对 at-least-once 做 **按 task/message id 去重** 提示或内置窗口
5. （可选）与 `heartbeat` 生命周期对齐，避免「listen 在跑但 agents me = offline」

ComicLaw / 各业务 skill 只负责：**被叫醒之后** 如何 accept / 干活 / submit。

## 建议形态

### A. CLI：内置 local receiver（推荐默认）

```bash
# 理想 DX：一条命令完成本机接收 + 投递
acn listen --runtime openclaw-hooks
# 或通用：
acn listen --runtime http --wake-url http://127.0.0.1:10122/hooks/agent --wake-header 'Authorization: Bearer …'
acn listen --runtime exec --wake-exec '/path/to/wake.sh'
```

语义：

| 组件 | 职责 |
|---|---|
| `acn listen` | Mode B WebSocket / relay（已有） |
| **local A2A receiver** | 本机绑定（默认 `127.0.0.1` 高位端口或固定可配端口）；应答 A2A/JSON-RPC，避免 handshake/转发失败 |
| **runtime adapter** | 把规范化事件交给宿主 |
| 业务 agent | 执行任务（非 ACN 职责） |

兼容旧用法：保留 `--forward <url>` / `--exec`，但文档应写明「生产推荐 `--runtime`」。

### B. 规范化事件（adapter 输入）

Adapter 不直接吞原始 A2A 细节亦可，但 CLI/SDK 应先归一成稳定结构，例如：

```json
{
  "event_type": "task_request",
  "task_id": "uuid",
  "subnet_slug": "comiclaw-internal",
  "message_id": "…",
  "received_at": "RFC3339",
  "raw": {}
}
```

字段名可按 ACN 现有 API 调整；关键是 **稳定 `task_id` / `message_id` 供去重**。

### C. 内置 adapter（MVP）

| id | 行为 |
|---|---|
| `http` | `POST wake-url`，JSON body = 规范化事件（或模板） |
| `exec` | 环境变量 / stdin 传入事件，执行命令 |
| `openclaw-hooks`（可选一等公民） | 对 OpenClaw `POST /hooks/agent` 或 `/hooks/wake` 的薄封装（token、path 可配） |
| `log` | 只记日志（调试） |

**不要**在 ACN 核心写死 ComicLaw Studio、扣款或 `production-worker.sh`。

### D. SDK

与 CLI 对等：`ACNClient.listen({ runtime: … })`（或独立 `LocalReceiver`），便于非 CLI 宿主嵌入。

## 非目标

- 不在 ACN 内实现各业务 skill（Studio 同步、出图、扣款等）
- 不强制所有 agent 使用 OpenClaw
- 不取代 Task Pool；listen 失败时仍应保留 list/reconcile/inbox 等拉取兜底
- 不要求公网 Mode A；本需求聚焦 Mode B / 无公网入站

## ComicLaw 验收场景（ACN 侧通过即可）

在仅安装 ACN CLI + 任一本机 wake 探针（不必装 Studio）的前提下：

1. `acn listen --runtime http --wake-url http://127.0.0.1:<probe>/wake` 常驻  
2. 向该 agent `invite` / 发送会经 relay 到达的 `task_request`  
3. **probe 在数秒内收到** 带 `task_id` 的规范化事件（或等价 HTTP）  
4. 重复推送同一 `task_id` 时，receiver/adapter 可配置为去重或标明 replay  
5. 进程重启后可再拉起；文档说明与 `heartbeat` 的推荐组合  
6. `--forward` 旧路径仍可用，但 README/skill 指向 `--runtime` 为生产默认

ComicLaw 自身再验：wake 之后主 agent 跑 `production-worker.sh handle`（属业务，不阻塞 ACN MVP）。

## 与现状能力的关系

| 已有 | 缺口 |
|---|---|
| `acn listen` | 无默认本机 A2A 服务 |
| `--forward` | 假定用户自备服务器；易指向空端口 |
| `--exec` | 偏底层；缺事件归一、去重、常见 runtime 预设 |
| `heartbeat` / Task list | 未与 listen 打包成「生产接收」一条路径 |

## 建议优先级

1. **P0：** `listen` + 内置 local receiver + `http` / `exec` adapter + 去重 + 文档  
2. **P1：** `openclaw-hooks` 预设；listen 与 heartbeat 的 systemd/示例 unit  
3. **P2：** SDK 对等 API；metrics/日志字段对齐

## 参考（ComicLaw 侧）

- 运维收口：`docs/ops-production.md`
- 官方生产 skill：`skills/comiclaw-studio/`（被叫醒之后的业务步骤）
- 临时本机 stub（应被 ACN `--runtime` 替代）：生产机 `comiclaw-a2a-forward.service`（仅防空端口，不叫醒 agent）
