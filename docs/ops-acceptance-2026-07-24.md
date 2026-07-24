# ComicLaw 生产验收归档（2026-07-24）

**范围：** invite → Mode B A2A wake → 自主 handle/accept/submit（WRITE_SCRIPT + GENERATE_IMAGE）  
**环境：** ACN `api.acnlabs.dev` **0.15.6**；CLI `@acnlabs/acn-cli@0.14.0`；工人 `acn listen --runtime command --wake-exec ~/.config/comiclaw/acn-to-openclaw-wake.sh`  
**关联：** ACN #198/#201；Studio [#36](https://github.com/acnlabs/comiclaw-studio/pull/36)、[#37](https://github.com/acnlabs/comiclaw-studio/pull/37)、[#38](https://github.com/acnlabs/comiclaw-studio/pull/38)

## Smoke 勾选结果

### A. 连通与身份 — 通过

| 项 | 结果 |
|---|---|
| ACN health | `{"status":"ok","version":"0.15.6"}` |
| Studio API | 建单/invite/落交付物均 2xx（本轮用运维侧 `STUDIO_API_KEY`） |
| 工人身份 | Comiclaw `cd7ec18a-…` **online** |
| `acn-listen.service` | **active**；`--runtime command --wake-exec …acn-to-openclaw-wake.sh` |

### B. 默认邀请闭环 — 通过

| 类型 | task | 结果 |
|---|---|---|
| WRITE_SCRIPT | `5b6642fa-3456-4b76-af0f-38a7aff94b1f` | invite→~1s wake→~2min `completed` + `push-script` |
| GENERATE_IMAGE | `2b94a6b0-3b4c-46e6-ab35-39e343d5a120` | wake 正确→~6min `completed`；Studio asset `cmryutvi40003jp04yzpwptmx` |

主路径：**不必**先 `reconcile`。OpenClaw Job ID ≠ ACN task id（wake 桥接已修）。

### C / D. 多工人与 `includeDefaultWorker=false` — 部分通过（2026-07-24 续）

| 项 | 结果 |
|---|---|
| C 双 invite | task `37b77902-…`：`workerAgentIds=[Aria]` + `includeDefaultWorker=true` → invitee/白名单含 Aria + 主 comiclaw；主工人 ACN 写 Studio **200** |
| D 排除默认工人 | task `24e1eb48-…`：`includeDefaultWorker=false` + 仅 Aria → 主 comiclaw **不在**白名单；主工人 ACN + `X-Acn-Task-Id` 写 Studio → **403** `not invited/assigned` |
| 开放工人可写 / 先 accept 竞态 | **未测**（无第二工人 API key） |

### E. 扣款路径 — **阻断**（2026-07-24 续）

| 项 | 结果 |
|---|---|
| AgentPlanet 扣款 | **失败**：`POST …/charge` → **502** `Agent not found: comiclaw`（`AGENTPLANET_AGENT_ID` 默认/配置的收款方在 AP 不存在） |
| 402 `INSUFFICIENT_BALANCE` | **未能复现**（到不了钱包余额判断；先被收款方 agent 校验挡住） |
| 同 key 幂等 SUCCESS | **未能复现**（同上） |
| 历史 GENERATE_IMAGE `2b94a6b0-…` | Studio 落 asset/`completed`，但 `GenerationChargeRef` 为 **`ERROR` amount=5**（工人未因非 2xx charge 停上游） |

**解除阻断：** 在 Vercel 将 `AGENTPLANET_AGENT_ID` 设为 AgentPlanet 上真实存在的收款 agent（并保证 `SERVICE_CHARGE_ALLOWLIST` 允许 `comiclaw-studio`→该 agent），再复测 402 / 幂等。

### F. reconcile 兜底 — 保留未专项破坏性测试

`comiclaw-reconcile.timer` 仍启用；本轮未停 listen 造漏推。

## 清扫（同日）

| 动作 | 结果 |
|---|---|
| 取消历史探针 `85c943ea-…` `[WAKE_PROBE]` | **cancelled**（creator=Comiclaw） |
| `reconcile` open_in_subnet | **0** |
| 非 `comiclaw-internal` 的全局/Org smoke open 单 | **未动**（非本工作室资产） |

## 生产机要点

- Skill：`~/.openclaw/workspace/skills/comiclaw-studio/`（含 `scripts/acn-to-openclaw-wake.sh`）
- Wake：`~/.config/comiclaw/acn-to-openclaw-wake.sh` + `hooks.token`
- 日志：`~/logs/comiclaw/acn-wake.log`（结构化字段；无 brief）
- CLI：**无需**为 0.15.6 再升（保持 ≥0.14.0）

## 后续（非阻断）

1. ~~身份 / 派单~~：**已定案** — 建单+invite 主工人只用 `comiclaw-studio`（`ACN_CHAT_*`）；客户 cell 不直派；ACN 已废止 `system:task-invite`
2. 专项：~~白名单~~（已验）；402/幂等 **被 AP 收款 agent 配置阻断**；开放工人可写/竞态仍缺第二 key
3. 中长期：Mode A 公网 `/a2a`；ACN skill 独立渠道同步
