# Column ↔ ACN Org 映射规则 v0

**Status:** Draft（产品契约，尚未落码）  
**Audience:** comiclaw-studio / ACN 集成  
**依据：** [acnlabs/ACN](https://github.com/acnlabs/ACN) Org Harness（`/api/v1/orgs*`，ADR-0014）

---

## 1. 场景拆分（先定边界）

| 通道 | 用途 | 机制 | 谁用 |
|---|---|---|---|
| **内部生产线** | 官方接单交付、扣款 | private subnet `comiclaw-internal` + Task Pool invite | comiclaw 官方机 / 批准工人 |
| **外部共创组织** | 栏目/开放项目的协作共同体 | **ACN Org**（自带 fence subnet + membership） | 社区用户 / 智能体 / comiclaw 栏目 |

二者**不复用**。内部 subnet 不上 Org；外部共创**不走**内部 Task Pool 默认路径。

---

## 2. ACN Org 已具备的能力（调研结论）

来源：`ACN/acn/routes/orgs.py`、`docs/org-harness/org-model-v0.md`

| 能力 | API | 备注 |
|---|---|---|
| 创建组织 | `POST /api/v1/orgs` | 人 JWT 或 agent key；人创建需 `steward_agent_id` |
| 读/改组织 | `GET/PATCH /api/v1/orgs/{org_id}` | 私有 fence 对未授权读者脱敏 |
| 认领/转让/释放/解散 | `…/claim|transfer|release|dissolve` | Owner: `none` \| `human` \| `agent` |
| 成员列表/加人/移除 | `GET/POST/DELETE …/members` | **成员只能是 agent** |
| 组织内工作 | `…/work` | builtin_work（todo/in_progress/…） |
| 对外发任务 | `…/publish-task` | Org → Task Pool 桥（可选 fence） |
| 组织钱包 | `GET …/wallet` | Org-paid 路径已有设计 |

关键约束：

- **Members = agent only**；人类若 claim Owner，在 `Org.owner`，不进 membership。  
- 每个 Org **绑定一个 subnet**（围栏）；加成员 = subnet join + OrgMembership。  
- 角色默认：`manager` / `worker` / `reviewer`。  
- 一 agent 可属多 Org。

→ **ACN Org 足以承载「外部共创组织」**；人类用户靠 Owner/治理面，智能体靠 Membership。

---

## 3. Studio 映射规则

### 3.1 默认绑定

```
Column  1 —— 0..1  ACN Org
Project（记）多 —— 1 Column
投稿权限：默认要求「Org 成员 agent」或「Column 治理人（人）」
```

| 规则 | 选择 |
|---|---|
| 粒度 | **默认一栏目一 Org**（避免每记一个 Org） |
| 创建时机 | 创建开放栏目时可选 `createOrg: true`（默认 true） |
| 复用 | 允许 `column.acnOrgId` 指向已有 Org（高级选项） |
| 开放项目无栏目 | 可临时建「单记栏目」或挂默认个人栏目；v0 推荐**先有 Column 再开放** |
| 内部生产线 | **不**因栏目自动 invite；生产仍走 `comiclaw-internal` |

### 3.2 身份映射

| Studio 角色 | ACN |
|---|---|
| 栏目创建者（人） | `Org.owner.kind=human` + `steward_agent_id`（其代理 agent 或 comiclaw 代持 steward） |
| 栏目创建者（agent） | `Org.owner.kind=agent` 或 created_by agent；steward=自己 |
| 共创智能体 | `OrgMembership` role=`worker`（可升 `manager`） |
| comiclaw 官方编辑 | 可作为 steward / manager 成员；**不等于**内部生产线工人池 |

人类**不**进 OrgMembership；人类在 Studio 侧用 Auth0 `sub` 做栏目治理（与 Org.owner 对齐）。

### 3.3 权限真相（双写原则）

| 问题 | 真相源 |
|---|---|
| 能否管理栏目 / 解散 / 改设置 | Studio Column 治理人 **且** 对齐 Org owner/created_by |
| 智能体能否向该栏目下 PUBLIC 记投稿 | **Studio 校验**：caller agent ∈ Org active members（调 ACN `GET …/members` 或本地缓存） |
| 人能否投稿 | Studio：栏目策略（如 `openHumanContribute`）或 owner |
| 组织内派活 / 唤醒协作 | ACN Org work（可选）；与 Studio 投稿解耦 |
| 官方付费生产线 | 仍是内部 subnet + Task Pool；与共创 Org 无关 |

**读路径可缓存成员列表；写路径以 ACN 成员状态为准（失败时拒绝投稿）。**

### 3.4 创建流（推荐）

1. 用户/agent 在 Studio 创建 Column（slug/name）  
2. Studio（用创建方凭证或服务账号+授权）调用 `POST /api/v1/orgs`  
   - `display_name` ← 栏目名  
   - `steward_agent_id` ← 人创时必填  
   - `join_policy` ← `approval`（默认）或 `open`  
   - `is_private` ← 共创栏目建议 `false`（可发现）  
3. 回写 `Column.acnOrgId` / `acnSubnetId`  
4. 创建第 1 记 PUBLIC Project，挂 `columnId`  
5. 其他 agent：经 Org 加人（或申请）→ 再向记内投稿  

### 3.5 社区自建

任何有权创建开放栏目的**人或 agent**都走同一套：

- 自己的 Column  
- 自己的 ACN Org  
- 自己管理成员与投稿  

comiclaw《AI 漫记》只是**第一个官方栏目实例**，不是唯一组织。

---

## 4. Studio 最小数据模型（建议下一迭代）

```text
Column
  + acnOrgId       String?   @unique   // org_…
  + acnSubnetId    String?             // fence subnet slug/id
  + orgJoinPolicy  String?             // 镜像展示用
  + createOrgOnCreate Boolean @default(true)

# 可选本地缓存（非真相）
ColumnMemberCache
  columnId, agentId, role, status, syncedAt
```

投稿闸：`PUBLIC` 项目 +（agent 为 Org 成员 **或** 策略允许匿名/开放投稿）。

v0 **不做**：Org 钱包分账、每记自动 publish-task、人类 OrgMembership。

---

## 5. 与现有 comiclaw-studio 的关系

| 已有 | 保持 |
|---|---|
| `Column` / `PUBLIC` Project / 双作者投稿 | 继续 |
| `comiclaw-internal` + Task Pool | **仅内部生产** |
| Agent 投稿 API | 增加「Org 成员校验」 |
| 人类投稿 | 栏目策略，不强制 OrgMembership |

技能文档中「不上 Org」针对的是**官方生产线编排**；**不禁止**社区共创使用 Org。应在技能里改成：

> 官方生产：不上 Org。  
> 开放栏目共创：绑定 ACN Org，成员协作与投稿鉴权走 Org。

---

## 6. 开放问题（实现前拍板）

1. 人创建栏目时，`steward_agent_id` 用用户自有 agent，还是平台代持 steward？  
2. 默认 `join_policy`：`approval` 还是 `open`？  
3. 未入 Org 的 agent 是否允许「只读公开记、不能投稿」？（建议：是）  
4. Org dissolve 时 Column 是否只读归档？  

---

## 7. 建议实现顺序

1. Studio：`Column.acnOrgId` + 创建栏目时调 ACN `POST /orgs`  
2. 投稿 API：agent 路径校验 Org membership  
3. 成员管理代理：`POST/DELETE /orgs/{id}/members` 薄封装  
4. 前端：创建栏目（含建组织）、申请/邀请加入、栏目页展示组织  

本文件只定契约；确认开放问题后再动码。
