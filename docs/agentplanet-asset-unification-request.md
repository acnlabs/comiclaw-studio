# 请求 AgentPlanet 协助：资产主体统一后的 `asset_ref` 迁移

**发起方：** ComicLaw Studio
**状态：** 已收到 AgentPlanet 正式答复（2026-07-31）。回复见 §12，主体统一已解锁
**相关文档：** 《ComicLaw × AgentPlanet 资产登记矩阵》、`COMICLAW_ASSET_REGISTRY_MATRIX.md`、`asset-v1.md`、`agent-asset-registry.md`

> 已收到《资产产权登记对接说明》。**主路径已迁到 `/api/assets/registry`，上架已迁到 `/api/store/assets/products`**，兼容别名不再使用（见 §10）。第 6 节要 ComicLaw 确认的项在 §11 回复。

---

## 1. 一句话问题

ComicLaw 要把「可交易资产」统一成一个主体，这会让**存量付费角色的 `asset_ref` 从 `comiclaw:character:{AgentCharacter.id}` 变成 `comiclaw:character:{Asset.id}`**。登记表与已上架商品都按旧 ref 记录，所以这一步必须和 AgentPlanet 一起做，我们不会单方面动。

---

## 2. ComicLaw 侧已按矩阵对齐的部分

| 矩阵要求 | 状态 |
|---|---|
| `asset_kind` ∈ character / scene / prop | 已支持（参数化） |
| `owner_type` ∈ user / agent / org（org 用 ACN `org_id`） | 已支持（principal 模型） |
| `asset_ref` = `comiclaw:{kind}:{localId}`，`source=comiclaw-studio` | 已支持 |
| 先 register 再上架 | 已是主路径，兜底上架也走同一顺序 |
| 上架 seller 必须等于登记 owner（含 org 不得用成员 Agent 冒名） | seller 由 owner 派生，不再假定是 agent |
| owner 与 `bound_agent_id` 分离 | 已修（此前把 owner 直接当 `bound_agent_id`，一旦 org 产权会把 `org_{uuid}` 写进 agent 字段） |
| `PATCH /asset-registry/{ref}` 改展示名 / 改出镜 Agent | 已接入（改角色名会同步 `display_name`） |
| `revoke` 幂等 | 已接入，404 视为成功 |

新增能力：项目内的资产（角色 / 场景 / 道具）现在可以「发布」为登记资产，**产权跟作者走**（agent 产出 → `owner_type: agent`；人产出 → `user`），并有 `draft → publishing → published → unpublishing` 状态机保证不会本地声称一个没登记成功的产权。

> 这里更正我们上一版的口径：上一版按「栏目绑了 ACN Org → 产权归 Org」解析，那会把社区 Agent 在《AI 漫记》下产出的场景连同授权收益一起划给 Org。已改为**谁做的归谁**，转给 Org 是显式的 `change-owner`，不是发布的副作用。

---

## 3. 现状：同一个 kind 命名空间下有两套 id

ComicLaw 目前有两张表都可以成为可交易主体：

| 主体 | 何时登记 | `asset_ref` | 是否有 Store 商品 | 授权记录 |
|---|---|---|---|---|
| `AgentCharacter`（数字人，早于登记表存在） | 仅当 `licensePoints > 0` 且已填收款 Agent 时 | `comiclaw:character:{AgentCharacter.id}` | 有（`storeProductId` 回填） | `CastingLicense.characterId` |
| `Asset`（项目资产，新可发布） | 发布时 | `comiclaw:{kind}:{Asset.id}` | **暂无**（发布不设价） | 暂无 |

两者 id 都是 cuid，实际碰撞概率可忽略，但**语义上 `comiclaw:character:` 里混了两个来源表的主键**。这正是我们要收敛的原因。

### 迁移规模：比"全部角色"小，但不等于"当前付费的角色"

`register` 只发生在 `licensePoints > 0` 的分支里，所以**从未付费过的角色确实从未登记**。

但有一个坑要说清楚：**角色从付费改回免费时，ComicLaw 只做 `unlist`，不做 `revoke`，本地 `storeProductId` 也不清空**（这是有意的——将来重新定价可以复用同一个商品）。所以「当前免费」的角色里，**曾经付费过的那些仍然有登记记录**。

因此：

- 用 `licensePoints > 0` 筛会**漏掉**这批曾付费、现免费的角色
- 我们能给出的本地超集是 `licensePoints > 0 OR storeProductId IS NOT NULL`
- 但**权威清单在你们侧**：按 `source=comiclaw-studio` 查登记表最准，因为还存在「登记成功、上架失败」的情况（那种本地连 `storeProductId` 都没有）

建议做法：你们按 `source` 导出登记表清单，我们用生产 Studio key 从 `GET /api/agent/characters` 导出上述超集，两边对一遍差集再定迁移范围。

---

## 4. 目标终态

`Asset` 成为唯一可交易主体；`AgentCharacter` 降级为挂在 character 类 `Asset` 上的**角色档案**（人设、音色、gallery、参演关系）。收敛之后：

- 一个 kind 命名空间只对应一张来源表
- 场景 / 道具与角色走同一套授权与上架路径（目前 `CastingLicense` 是角色专用的，场景道具即使登记了也无法授权）
- 产权与收款方只有一处真相，对得上登记表的 `owner_type` / `owner_id`

---

## 5. 为什么不能单方面迁

改主体等于**换 `localId`**，于是 `asset_ref` 变了。牵连三处：

1. **登记表**按 `asset_ref` 作键，旧 ref 会变成孤儿，新 ref 没有历史
2. **已上架商品**的 `asset_metadata.asset_ref` 指向旧 ref
3. **Store 校验 seller == 登记产权人**，迁移期间任何一侧不同步都会 403

失败形态很难看：要么买家付了钱拿不到货，要么收益打给错的收款方。所以在你们答复前，ComicLaw 不会改动任何已登记资产。

---

## 6. 需要 AgentPlanet 答复的问题

1. **能否给已登记条目「换键」？** 有没有支持的方式在保留产权与历史的前提下把 `asset_ref` 从 A 改成 B？还是只能 `revoke` 旧的 + `register` 新的？
2. 如果只能 revoke + register，**已上架商品怎么办？** 能否 `PATCH` 商品的 `asset_metadata.asset_ref`？还是必须下架重上（那会换 `product_id`，我们本地 `storeProductId` 与进行中的订单都要跟着处理）？
3. **订单与收益归因是挂在 `product_id` 还是 `asset_ref` 上？** 如果商品被下架重上，已完成订单的归因与结算是否不受影响？
4. **能否支持 alias（旧 ref → 新 ref）？** 若可以，我们就能先在自己这边收敛主体，商品与登记完全不动，风险最低。这是我们最希望的方案。
5. **生产是否已开启 `store_asset_registry_enforce`？** 若已开启，迁移期间是否能给一个观察窗口（未重新登记的资产仍可上架），避免中途出现「登记了新 ref、商品还挂旧 ref」导致上架被挡？
6. **过渡期允许一个 kind 命名空间里混两套来源 id 吗？** 你们侧对 `asset_ref` 是否有唯一性/格式校验会因此报警？
7. **执行方与窗口：** 换键 / alias 由谁执行？需要我们提供受影响 ref 清单吗（我们可以导出）？希望约在什么窗口？

---

## 7. 顺带需要确认的两件小事

1. **`unlist` 与商品 `PATCH` 是否接受 `seller_type`？**
   这两个端点历史上只收 `seller_id`。矩阵要求 seller 与登记 owner 一致，但没给这两个端点的 payload 示例。我们出于谨慎做了区分：**agent 卖家保持只发 `seller_id`**（多发一个字段若被旧 schema 拒绝，会导致「关掉付费但商品下不掉架、继续可买」），`org` / `user` 才带 `seller_type`。请确认这两个端点是否已统一接受 `seller_type`，我们好把行为归一。

2. **CN 分区**
   矩阵第 6 节要求全球与 CN 分别注册 Org / Agent，但 ComicLaw Studio 目前只有单一 `AGENTPLANET_API_URL` / `ACN_API_URL`，**跑不了双分区**。CN 侧的栏目 Org 也还没建。如果 CN 上线有时间表，请告知，我们需要先做分区配置。

---

## 8. 矩阵第 8 节：ComicLaw 侧的回答

| 问题 | 回答 |
|---|---|
| 栏目默认产权主体 | **不按栏目定，按作者定**：Agent 产出 → `agent`（其 ACN agent_id）；人产出 → `user`（Auth0 sub）；`org` 只在资产本就属于组织时使用，且必须显式 `change-owner`。栏目绑了哪个 Org 不影响产权 |
| 栏目 `org_id`（全球） | `org_a3a067ed8b4342b6bc4b82c7be3ea12c`（《AI 漫记》，已在生产创建） |
| 栏目 `org_id`（CN） | **暂无**，见 §7.2 |
| Studio 收款 Agent | 现有 `CHARGE_PAYEE_AGENT_ID = 90f884c1-f7fd-4e6f-b375-84521539648a`（comiclaw-studio）是**用量扣款**收款方，按你们「产权 ≠ 扣款」的口径我们不复用它持有资产。comiclaw 自己产出的资产由**实际产出的那个 Agent**（已在 AgentPlanet 注册的几个）或 comiclaw 组织持有，不需要新设代持 Agent |
| 存量角色批量补登记窗口 | **建议观察模式，不需要批量补登记。** 现网只有 `licensePoints > 0` 才登记；免费角色从未登记，但也从未上架，enforce 不影响它们；一旦改价，上架前会自动补登记 |

---

## 9. 在答复前 ComicLaw 会做什么

不依赖上述答复的部分我们继续推进，且**完全不碰已登记资产**：

- 通用授权表 + **免费**授权：把已发布资产复制进自己的项目（场景 / 道具终于可用）
- 已发布资产的浏览入口

付费授权（新增上架 + 下单 + 对账）会照搬角色那套幂等抢占与自愈，但**只新增、不改旧链路**。主体统一（`AgentCharacter` 降级）等本文件的答复。


---

## 10. 已按《对接说明》完成的改动

| 项 | 之前 | 现在 |
|---|---|---|
| 登记主路径 | `/api/store/asset-registry` | **`/api/assets/registry`** |
| 上架路径 | `/api/store/agent-assets/products` | **`/api/store/assets/products`**（含 `PATCH` / `unlist` / `order`） |
| 鉴权头 | `X-Internal-Token` | 不变，已符合 |
| 重复登记 409 | 已按 `exists` 处理 | 不变 |

路径统一收在一个契约模块里，并有离线校验钉死「不得退回兼容别名」，避免新代码无声漂回旧路径（旧路径仍会 200，不会自己报错）。

`GET /api/assets/registry/{asset_ref}` **已接**，用于下单前只读确认登记态，见 §12.6。

## 10.1 一处需要你们确认的基址口径

《对接说明》§2 写「全球：以贵司现网 AgentPlanet Backend 为准（**如 api.acnlabs.dev**）」。我们实测（无 token，看路由是否存在）：

| Host | `GET /api/assets/registry/{ref}` | 判断 |
|---|---|---|
| `api.agentplanet.org` | **401** | 路由存在（缺 token）——**这正是 ComicLaw 现网配置的基址** |
| `api.acnlabs.dev` | **404** | 登记表**不在**这个 host 上（这是我们调 ACN 的地址） |
| `api.acnlabs.cn` | **401** | CN 分区路由存在 |

所以我们判断 §2 里的 `api.acnlabs.dev` 是笔误，全球仍走 `api.agentplanet.org`，**现网配置无需改动**。如果你们的意图是「登记表要迁到 ACN backend」，请明确告知——那会是一次基址变更，我们需要单独安排。

## 11. 回复《对接说明》第 6 节

| 问题 | ComicLaw 回复 |
|---|---|
| 栏目默认产权主体 | **产权跟作者走，与栏目无关**。Agent 产出 → `agent`；人产出 → `user`；`org` 仅在资产本就属于组织时使用。所谓「官方」就是 comiclaw 自己：comiclaw 名下的 Agent 产出的资产归那个 Agent，comiclaw 组织产出的归组织——和任何第三方 Agent 一视同仁，栏目运营方不代持贡献者的资产 |
| 栏目 `org_id` 全球 | `org_a3a067ed8b4342b6bc4b82c7be3ea12c`（《AI 漫记》，已在生产创建） |
| 栏目 `org_id` CN | **暂无**。ComicLaw Studio 目前只有单一 `AGENTPLANET_API_URL` / `ACN_API_URL`，**跑不了双分区**；CN 要上线需要我们先做分区配置，再建 CN 侧 Org |
| 若用 agent 持有：收款 agent_id | **不复用** `CHARGE_PAYEE_AGENT_ID`（那是用量扣款收款方，与产权分离）。也**不需要代持 Agent**：产权跟作者走，comiclaw 侧就是已注册的那几个 Agent 各自持有自己的产出 |
| 存量角色补登记 | **建议先观察**。从未付费过的角色确实从未登记，也从未上架，强制模式不影响它们；一旦改价，上架前会自动补登记。注意「曾付费、现免费」的角色仍有登记记录（我们只 unlist 不 revoke，见 §3）。真正需要处理的是 §5–§6 的 `asset_ref` 迁移 |
| 对接环境优先级 | **先全球**（现网数据都在全球侧，且 CN 需要我们先改分区配置）。CN 的时间表请给一下，我们据此排分区改造 |
| 预计联调窗口 | 待定，取决于 §6 的 `asset_ref` 迁移方案（尤其是能否支持 alias） |

### 需要提醒的一点

你们写「CN 生产默认未登记不可上架（`store_asset_registry_enforce=true`）」。ComicLaw 侧**登记失败不阻塞上架**（best effort，注释里写的是「观察模式对未登记资产放行」）。在 enforce 为真的环境里，这个假设不成立：登记失败会导致后续上架被挡，而我们当时不会报错。CN 接入前我们会把这条改成 fail-closed，但**前提是先确认 CN 的基址与 token**。

---

## 12. 回复 AgentPlanet 正式答复的 §8

### 12.1 主体统一：按「无对外存量」执行

**是，按此执行**，但要说清当前状态：主体统一（角色付费上架改用 `Asset.id`）**还没做**，这一步是独立的一刀。

- 项目资产发布（场景 / 道具 / 角色）**已经**按 `comiclaw:{kind}:{Asset.id}` 登记
- 角色付费上架**目前仍用 `comiclaw:character:{AgentCharacter.id}`**，会在主体统一那一刀改掉
- 测试期旧 ref 走 revoke → 重登记 → 重上架 → 回填本地 `storeProductId`，与你们建议一致

一个前提要请你们**书面确认**：结论建立在「资产付费能力尚未对外推出、生产无真实用户存量」上。ComicLaw 侧看不到你们登记表与订单的全貌，所以这条前提由你们背书。**如果生产上其实存在真实已完成订单，revoke + 重上架会让那批订单的 `asset_ref` 与新登记项脱钩**，届时我们需要改回等 alias 的方案。

### 12.2 fail-closed：已完成，本次即上线

`store_asset_registry_enforce` 在两个环境都是 True，而我们此前登记失败仍会继续上架，属于现网隐患：客户设了价、以为在售，enforce 下实际不可买且**我们不会报错**。

已改为 fail-closed：

- 登记被拒（`failed`），或已存在但产权改绑没成功（`exists` + change-owner 失败）→ **不上架**
- 角色创建 / 更新接口在响应里多带 `listingBlocked: true` 与 `listingError`，让 comiclaw 能明确告诉客户「价没生效」
- 授权兜底上架路径遇到登记被拒时返回「未上架」，走既有的 `402 NOT_LISTED`，不再继续下单
- 规则收在一个函数里并有离线校验，包含「已登记但产权仍属他人不得上架」这一条

顺带修掉一个漏洞：删除角色时原先要求 `acnAgentId` 存在才下架商品，于是**没有收款方却有商品的角色永远下不掉架**。现在只要拿得到当初的收款 Agent 就下架；拿不到时打显式错误日志，需要人工处理（下架端点要用 `seller_id` 匹配卖家）。

### 12.3 `seller_type` 已按你们口径归一

确认「unlist / 商品 PATCH 只认 `seller_id`，多传 `seller_type` 会被忽略」后，这两个端点**统一只发 `seller_id`**（不再按 owner 类型分支）。建商品仍按示例同时发 `seller_type` + `seller_id`。

这里我们理解成「只读这一个字段」而不是「不需要这个字段」——`seller_id` 仍会发，因为它是匹配卖家用的，不发有下架失败、商品继续在售的风险，而下架失败在我们这边是被吞掉的。若实际上 unlist 完全不需要 body，请告知，我们再简化。

顺带暴露一个存量问题：商品是当初以某个收款 Agent 建的，如果本地 `acnAgentId` 后来被清空，我们就**无法匹配卖家去下架**。这类记录现在会打显式错误日志，需要人工处理；如果你们的清单里能带上商品的 seller，我们可以据此补齐。

### 12.4 是否需要你们导出登记清单

**需要。** 请导出一版全球 `source=comiclaw-studio` 的登记清单（含 `asset_ref` / `owner_type` / `owner_id` / 是否有在架商品）。我们用 `licensePoints > 0 OR storeProductId IS NOT NULL` 做交叉核对，把测试残留清干净，避免统一后留下指向 `AgentCharacter.id` 的孤儿登记项。

### 12.5 CN 分区排期

**暂无。** ComicLaw Studio 目前是单基址（`AGENTPLANET_API_URL` / `ACN_API_URL`），要接 CN 需要：分区配置（双基址 + 双 token）、CN 侧 Org 创建、以及产权主体在两区分别登记。CN 付费资产在此之前不接。有确定排期我们会单独同步。

### 12.6 下单前会重新确认登记

顺带修掉一处 enforce 相关隐患：原先本地只要有 `storeProductId` 就直接下单，而 enforce 之前上架的商品**可能从未登记**——那样订单会在你们侧被挡，我们这边看起来却一切正常。

现在下单前会**只读地确认**两件事：`GET /api/assets/registry/{ref}` 确认确实登记过，`GET /api/store/assets/products/{id}` 确认商品在架且未被审核拒绝；任一不满足就回 `402 NOT_LISTED`。

这里刻意不走「登记 → 上架」同步：那会把 `is_active` 置回 true，等于**买家的下单动作把卖家或审核方故意下架的商品重新激活**，还会覆盖名称与价格。所以 §12.7 提到的 GET 现在就接上了——这正是需要它的场合。

### 12.7 `GET /api/assets/registry/{ref}` 已接

按你们建议接上了，用途见 §12.6：下单前只读确认登记态。查不到或不可达都按「没登记」处理（fail-closed）。
