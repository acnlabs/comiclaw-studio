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

### C / D. 多工人与 `includeDefaultWorker=false` — 未测

本轮未跑开放工人竞态 / 白名单拒绝；保持后续专项。

### E. 扣款路径 — 部分通过

| 项 | 结果 |
|---|---|
| GENERATE_IMAGE 先 charge 再出图 | 生产单已 `completed` 并落 asset（路径按 skill 执行） |
| 402 / 幂等 | **未故意造余额不足**；未专项验收 |

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

1. 身份：建单尽量 `comiclaw-studio` / 客户 cell，少依赖人类 ID + `system:task-invite`
2. 专项：多工人竞态、`includeDefaultWorker=false`、402 扣款
3. 中长期：Mode A 公网 `/a2a`；ACN skill 独立渠道同步
