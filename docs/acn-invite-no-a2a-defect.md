# ACN 缺陷：Task Pool invite 未经 Mode B A2A 推送（ComicLaw 复现）

**状态：已关闭**（2026-07-24 ComicLaw 生产验收通过）  
**严重度：** 曾阻断「invite → 工人自主执行」闭环  
**环境：** ACN global `api.acnlabs.dev` **0.15.6**；工人 CLI `@acnlabs/acn-cli@0.14.0`；`acn listen --runtime command`  
**关联：** [acn-listen-runtime-cutover.md](./acn-listen-runtime-cutover.md)、ACN #191 / #198 / #201、tag `v0.15.6`

## 修复进展（ACN）

- **生产：** `https://api.acnlabs.dev/health` → `{"status":"ok","version":"0.15.6"}`（[ACN #198](https://github.com/acnlabs/ACN/pull/198) + [ACN #201](https://github.com/acnlabs/ACN/pull/201) / tag）
- **行为：** `invite` 写白名单后 best-effort 推送 A2A `task_request`（Mode A/B/inbox）
- **CLI：** 工人保持 **0.14.0** 即可（接收侧 #191；本次只改服务端发送）
- **Skill：** ACN 仓库内 skill 写明 `tasks invite` 会 best-effort A2A；若从独立渠道安装需自行同步

## 验收结果（ComicLaw · 2026-07-24）

| 项 | 结果 |
|---|---|
| 工人 listen | `acn listen --runtime command --wake-exec …` connected；agent **online** |
| Studio 建单+invite | `POST …/acn-tasks` **201**；task `f4d0b3e0-01c4-4ae7-8025-519ca91ed803`；`inviteeIds=[cd7ec18a-…]`；`inviteErrors=[]` |
| wake | **约 1s 内**（建单 `10:18:28Z` → wake `10:18:29Z`，`wake_http=200`，OpenClaw `runId=370628e7-…`） |
| 是否靠 reconcile | **否**（wake 先于任何 list） |

结论：**invite → Mode B A2A → `--runtime` 叫醒宿主** 已通。`reconcile` 仅保留作漏推/重启兜底。

## 期望（已满足）

Studio（建单账号 `comiclaw-studio`）在 private subnet `comiclaw-internal` 内：

1. `POST /tasks` 创建生产任务（`use_escrow=false`）
2. `invite` 主 comiclaw（Mode B，常驻 `acn listen --runtime …`）
3. 工人本机 listen 数秒内收到可唤醒的 A2A（如 `task_request`）
4. CLI `--runtime` 叫醒宿主 Agent（后续由 Agent 自主 `accept` / 干活 / `submit`）

## 历史复现（修复前 · 2026-07-24）

修复前：invite 写入 Task Pool，但 Mode B relay **无** inbound；notify/inbox 空；只能靠 `reconcile` 列出 open 任务。

1. 工人：`acn listen --runtime command --wake-exec <wake-to-openclaw>`（online + connected）
2. Studio（生产 key）建项目并：

```http
POST /api/agent/projects/{projectId}/acn-tasks
{ "type": "WRITE_SCRIPT", "input": { "brief": "…", "title": "…" }, "includeDefaultWorker": true }
```

3. 示例任务（修复前）：`40c6d679-26e2-42f5-b4c7-033c56909532`  
   - creator: `comiclaw-studio` (`90f884c1-…`)  
   - invitee / worker: Comiclaw (`cd7ec18a-…`)  
   - subnet: `comiclaw-internal`
4. 观察 ≥30s：listen journal 无 inbound；wake 日志无新行；notify/inbox 空

对照：向 wake-exec **手动喂**同结构事件 → OpenClaw `/hooks/agent` **200**。宿主与 CLI runtime 正常；缺口在 **invite → 推送**（已由 ACN 0.15.6 修复）。

## Mode A 说明（历史）

根因是 invite **未发** A2A 时，切 Mode A（公网 `/a2a`）**不能**绕过。本缺陷已在服务端发送侧关闭；ComicLaw 生产保持 Mode B + `--runtime`，`reconcile` 仅兜底。

## 非本缺陷

- OpenClaw hooks / wake-exec（手动事件可叫醒）
- Studio 建单/映射（201 + `AcnTaskRef` + `metadata.studio`）
- CLI `--runtime` 接收器本身（ACN #191 已落地）
