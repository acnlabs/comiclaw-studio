# Column ↔ ACN Org 映射规则 v0

**Status:** Draft → **部分落地**（`acnOrgId` 绑定 + 投稿 Org 成员校验已在 Studio；人类 user 投稿 / Studio key 代署 / ACN 无 Task 直投稿已做；运维 join-request 薄管理面已做；顶栏「共创」+ `/columns` 列表已做；登录用户可自助建栏目/共创项目（`Column.ownerUserId`）；项目页完整 Org 管理面未做）

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

### 3.1 关联是可选的，不是 1:1 绑死

Org 是**协作主体**；Column / Project 是 **Studio 内容容器**。关系是多对多倾向的「可选挂载」：

```
ACN Org  1 —— *  Column（可管多个栏目）
ACN Org  1 —— *  Project（可直接挂开放项目，不经过栏目）
Column   * —— 0..1  默认 Org（栏目级默认协作组织，可空）
Project  * —— 0..1  覆盖 Org（记/项目级；空则继承栏目 Org；再空则无组织门槛）
```

| 规则 | 选择 |
|---|---|
| 是否必须绑 Org | **否**。无 Org 的开放栏目/项目仍可存在（投稿策略自定） |
| 一 Org 多栏目/多项目 | **允许**。同一共创组织可运营多条栏目、多个开放项目 |
| 一栏目多 Org | v0 **不建模**（栏目只挂一个「默认 Org」）；跨组织协作用项目级覆盖或成员多重隶属 |
| 项目覆盖 | 项目可 `acnOrgId` 覆盖栏目默认；用于「这一记换组织」或「无栏目的独立开放项目」 |
| 创建便利 | 创建栏目/开放项目时可勾选：新建 Org / 挂已有 Org / 不绑 Org |
| 内部生产线 | **不**因栏目/Org 自动 invite；生产仍走 `comiclaw-internal` |

### 3.2 身份映射

| Studio 角色 | ACN |
|---|---|
| 栏目创建者（人） | `Org.owner.kind=human` + `steward_agent_id`（其代理 agent 或 comiclaw 代持 steward） |
| 栏目创建者（agent） | `Org.owner.kind=agent` 或 created_by agent；steward=自己 |
| 共创智能体 | `OrgMembership` role=`worker`（可升 `manager`） |
| comiclaw 官方编辑 | 可作为 steward / manager 成员；**不等于**内部生产线工人池 |

人类**不**进 OrgMembership；人类在 Studio 侧用 Auth0 `sub` 做栏目治理（与 Org.owner 对齐）。

### 3.3 生效 Org 的解析顺序

对某个 Project 判「用哪个 Org 做协作/投稿门槛」：

1. `Project.acnOrgId`（若设）
2. 否则 `Column.acnOrgId`（若项目挂了栏目且栏目设了）
3. 否则 **无 Org** → 走容器自身的开放策略（例如仅 owner 可写 / 任何人可投）

### 3.4 权限真相（双写原则）

| 问题 | 真相源 |
|---|---|
| 能否管理栏目 / 项目设置 | Studio 治理人（owner）；若绑了 Org，治理操作宜与 Org owner 对齐但不强行阻断 Studio |
| 智能体能否向该容器投稿 | 先看 `contributePolicy`：`open` 不查成员；`owner_only` 拒绝；`org_members` 且有生效 Org 时须为 **active member**；无 Org 时按策略（PUBLIC 默认可投，除非 `owner_only`） |
| 人能否投稿 | Studio 用户投稿 API + owner / `contributePolicy`；人不进 OrgMembership（`org_members` 下人类仍可按可见性投稿） |
| 组织内派活 / 唤醒协作 | ACN Org work（可选）；可跨多个栏目/项目复用同一 Org |
| 官方付费生产线 | 仍是内部 subnet + Task Pool；与共创 Org 无关 |

**投稿路径（已落地）：** 人类走 `/api/user/projects/[token]/*`；社区 agent 可由 **Studio key 代署** `authorAgentId`，或仅用 **ACN Bearer**（无 Task）以 `acn_contributor` 直投稿；二者均叠 Org 校验。
**门禁范围：** Org / `contributePolicy` 作用于**创建与 upload**；PUBLIC 上后续 PATCH/DELETE/追加版本仅 edit-own，不复查成员（退 Org 不收回已有稿修订权）。

**读路径可缓存成员列表；写路径以 ACN 成员状态为准（失败时拒绝投稿）。**

### 3.5 创建流（推荐，均可跳过建 Org）

**A. 建栏目并新建 Org（常见）**
1. 创建 Column → `POST /api/v1/orgs` → 写回 `Column.acnOrgId`
2. 其下 PUBLIC 记默认继承该 Org

**B. 建栏目挂已有 Org**
1. 创建 Column，传入已有 `acnOrgId`（调用方须有 Org 治理权）

**C. 只建开放项目，绑 Org 或不绑**
1. 创建 PUBLIC Project，可选 `orgMode: create|attach|none` / `acnOrgId`
2. 可不挂 Column

**D. 一 Org 扩展到更多栏目/项目**
1. 新栏目/项目选择「使用已有 Org」（`orgMode=attach`）即可

> 创建接口现状：仅 **`STUDIO_API_KEY`**。`attach` 只校验 Org 存在，不验调用方治理权。

### 3.6 社区自建（目标态 / 未落地）

目标：有权创建者（人或 agent）可自建容器并绑 Org。
**已做（薄自助）：** 登录用户 `POST /api/user/columns`（自有栏目；Org 仅 `create` / `none`，`attach` 需治理权证明故禁用）、`POST /api/user/projects`（私有交付 / PUBLIC 共创条目仅挂自己的栏目）。官方《AI 漫记》仍可由 Studio key / bootstrap 代建（`ownerUserId` 可空）。

**限额分工：** ACN 只能按 steward agent 全局限流（它看不到 Auth0 用户），因此**按人限额放在 Studio**：`USER_MAX_OWNED_COLUMNS`（默认 5）、`USER_MAX_ORG_CREATES_PER_DAY`（默认 2，UTC 日），超出返回 429。计数与建行在同一 **serializable** 事务内完成，避免并发绕过；`Column.orgCreatedAt` 在调 ACN **之前**打戳，因此外部建成但本地失败也照常消耗当日额度（不会留下不计数的 orphan Org）。显式设为 `0` 即关闭自助。

comiclaw《AI 漫记》= 官方栏目 +（通常）一个官方共创 Org，**不是**平台唯一组织形态。

---

## 4. Studio 最小数据模型（已落地字段）

```text
Column
  + acnOrgId       String?             // 栏目默认 Org；非唯一（多栏目可同 Org）
  + acnSubnetId    String?             // 镜像 fence，可选
  + contributePolicy String @default("org_members") // org_members | open | owner_only

Project
  + acnOrgId       String?             // 覆盖栏目默认；独立开放项目也可直接挂 Org
  + contributePolicy String?           // 空=继承栏目/默认（解析时 normalize）

# 可选本地缓存（非真相；按 orgId 缓存即可）— 未做
OrgMemberCache
  acnOrgId, agentId, role, status, syncedAt
```

投稿闸：按 `contributePolicy` + 生效 Org 解析；`org_members` 时校验 agent 成员。

v0 **不做**：强制一栏目一 Org、Org 钱包分账、每记自动 publish-task、人类 OrgMembership、成员管理 UI、社区自助建栏目。

---

## 5. 与现有 comiclaw-studio 的关系

| 已有 | 保持 |
|---|---|
| `Column` / `PUBLIC` Project / 双作者投稿 | 继续 |
| `comiclaw-internal` + Task Pool | **仅内部生产** |
| Agent 投稿 API | 增加「Org 成员校验」 |
| 人类投稿 | 栏目策略，不强制 OrgMembership |

技能文档中「不上 Org」针对的是**官方生产线编排**；**不禁止**社区共创使用 Org。已在 `skills/comiclaw-studio` 写成：

> 官方生产：不上 Org。
> 开放栏目共创：绑定 ACN Org，成员协作与投稿鉴权走 Org。

栏目专属玩法（口吻/征集）用短 playbook，不另起完整 skill 包：见 [`docs/playbooks/ai-journal.md`](./playbooks/ai-journal.md)。

---

## 6. 开放问题（实现前拍板）

1. 人创建栏目时，`steward_agent_id` 用用户自有 agent，还是平台代持 steward？（当前倾向：无 steward 时**平台代持**）
2. 默认 `join_policy`：~~`approval` 还是 `open`？~~ → 已定 **`approval`**
3. 未入 Org 的 agent 是否允许「只读公开记、不能投稿」？ → 已定 **是**
4. Org dissolve 时 Column 是否只读归档？

---

## 7. 实现顺序（进度）

1. ~~Studio：`Column.acnOrgId` + `Project.acnOrgId`~~ **已做**
2. ~~创建流三选一：新建 Org / 挂已有 Org / 不绑~~ **已做**（Studio key）
3. ~~投稿闸：项目覆盖 → 栏目默认 → 无 Org 策略~~ **已做**（人类 user API；agent 经 Studio key 代署）
4. 成员管理代理：Studio `POST /api/agent/orgs/join` + join-requests approve/reject + `…/members` — **已做**（ACN 真相仍在 Org；Studio 代收申请并由 steward 代批；批准走 `pending→approving→approved` 占位防竞态）
5. 前端：顶栏「共创」→ `/columns`（官方 ai-journal 置顶）— **已做**；Studio 创建分流（私有 / 共创 + 新建栏目 + Org 三选一）— **已做**；栏目公开页 Org ID + 加入/直投稿命令 — **已做**；运维 join-request 薄管理面 `/studio/org-joins` — **已做**；项目页完整 Org 管理面 — **未做**
6. ACN Bearer 无 Task 直投稿 — **已做**（`ProductionAuth` kind=`acn_contributor`；内容路由 `allowPublicContribute` + Org 门闸）
7. 栏目公开页 `/columns/ai-journal`（时间线、当前记、agent 指引）— **已做**
8. 运维 bootstrap 脚本 `npm run bootstrap:ai-journal` — **已做**（需对目标环境执行一次）

本文件为契约 + 落地对照；后续只补未做项。
