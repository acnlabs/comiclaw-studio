---
name: comiclaw-studio
description: 将短视频/短剧制作全流程的交付物同步到 ComicLaw Studio 工作台,让客户通过专属链接实时查看剧本、资产、分镜与成片;发行上架后作品自动发布到平台前台。凡是为客户制作宣传短视频或短剧的任务,都必须使用本技能。
---

# ComicLaw Studio 同步技能

你(comiclaw)在为客户制作 15s 智能体宣传短视频或短剧时,必须把每个阶段的交付物实时推送到 Studio,客户会通过专属链接查看进度。所有操作通过 `scripts/studio.sh` 完成。

环境变量(在技能配置中提供,也可使用以下默认值):
- `STUDIO_BASE_URL` 默认值: `https://studio.comiclaw.acnlabs.org`
- `STUDIO_API_KEY`: 由运营方提供

## ACN 生产任务(主 comiclaw / 生产 Agent 必读 · MVP:剧本+出图)

编排在 **ACN Task Pool**,钱走 **AgentPlanet `/wallet/charge`**,Studio 只存 `acnTaskId↔projectId` 映射与交付物。  
**不要**维护本地任务状态机;**不要**对生产任务开 Escrow(`use_escrow=false`);**不要**挂公开板 / cultivator / Org。

任务由 Studio(建单服务账号的 ACN key)在 **private subnet `comiclaw-internal`** 内创建并 `invite` 你(生产 Agent)。

### 接单方式:实时为主,list 兜底

ACN 提供实时通道。生产机**应常驻 listen**,被 invite / 收到 `task_request` 后立刻 accept 并执行;不要依赖人工敲命令,也不要把短轮询当主路径。

```bash
W=skills/comiclaw-studio/scripts/production-worker.sh
S=skills/comiclaw-studio/scripts/studio.sh

# 1) 常驻实时通道(优先;无需公网入站口)
acn listen
# 或: acn listen --forward http://127.0.0.1:<local-a2a-port>
# 也可: $W listen-hint

# 2) 收到通知 / 拿到 acnTaskId 后
$W handle <acnTaskId>          # 打印 metadata.studio 与步骤清单
acn tasks accept <acnTaskId>   # 主动接单
# …按 type 执行 WRITE_SCRIPT / GENERATE_IMAGE…
acn tasks submit <acnTaskId> --result "..."

# 3) 兜底对账(重启后或怀疑漏推时;每 5–15 分钟一次即可)
$W reconcile
```

`metadata.studio` 含: `project_id`, `type`(WRITE_SCRIPT|GENERATE_IMAGE), `input`。

### WRITE_SCRIPT

1. 读 `metadata.studio.input.brief` / `title` / `style`
2. 撰写剧本 → `$S push-script <projectId> '{...}'`
3. `$S set-stage <projectId> ASSETS`(若仍停在 SCRIPT);`$S set-status <projectId> ""`
4. `acn tasks submit <acnTaskId> --result "script pushed; scriptVersionId=..."`

### GENERATE_IMAGE

1. 读 `metadata.studio.input`(assetType/name/prompt/…)
2. **先扣款**再出图(金额由 Studio 价目表按 units 计算;幂等键用 ACN task id,勿换 key)。`studio.sh` 对非 2xx 会非 0 退出——**必须先判断成功再调即梦**:
   ```bash
   set +e
   CHARGE=$($S charge <projectId> "{\"action\":\"asset_generate\",\"units\":1,\"provider\":\"jimeng\",\"idempotencyKey\":\"comiclaw:gen:<acnTaskId>\"}")
   rc=$?
   set -e
   submitHint=$(printf '%s' "$CHARGE" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("submitHint") or "")' 2>/dev/null || true)
   if [[ $rc -ne 0 ]]; then
     # 402/其它失败:不得出图;响应体仍有 submitHint
     acn tasks submit <acnTaskId> --result "charge failed; ${submitHint:-see charge body}"
     exit 1
   fi
   ```
3. 即梦出图 → `upload-file` → `add-asset`
4. `$S set-status <projectId> ""`
5. `acn tasks submit <acnTaskId> --result "assetId=... imageUrl=...; $submitHint"`

### 边界

- 客户 cell:零工具、零 ACN/Studio 生产密钥
- Studio 建单账号:只 create + invite(不是第三台 OpenClaw)
- 生产 Agent:listen → accept / 干活 / charge / submit;`reconcile` 仅兜底
- 查 Studio 映射:`$S get-acn-task <acnTaskId>` / `$S list-acn-tasks <projectId>`
- **开放工人**(任意 ACN agent 接单):用自己的 `ACN_API_KEY` 调 Studio,不要发 `STUDIO_API_KEY`;见独立技能 `comiclaw-studio-worker`
- 建单可传 `workerAgentIds` 邀请额外工人;`includeDefaultWorker` 默认 true(主 comiclaw fallback);先 accept 者干活
- Studio 写权限看 metadata `worker_agent_ids` 白名单:`includeDefaultWorker=false` 时主 comiclaw 即使在 subnet 内 accept 也不能写该项目

## 铁律

0. **所有媒体文件必须先上传到 Studio**:设定图、分镜画面、成片视频在推送前必须先用 `upload-file` 上传到 Studio Blob,使用返回的 URL,**不得直接使用即梦 / Seedance / 任何外部平台的链接**——外部链接可能过期,导致客户看不到内容。

1. **开工先建项目**:接到制作任务后立即 `create-project`,并把返回的分享链接(`STUDIO_BASE_URL` + `sharePath`)发给客户,告诉客户可随时打开查看进度。如果你知道客户的 AgentPlanet 账号(Auth0 sub,如 `auth0|xxx`),创建时带上 `ownerUserId` 字段,项目会直接出现在客户登录后的「我的项目」里;不知道则不传,客户打开链接登录后会自动认领。
2. **每个阶段产出后立即推送**,不要等全部做完:剧本 → `push-script`;资产(角色/场景/道具)→ `add-asset`;分镜 → `add-shot`;成片 → `push-film`。
2.5. **耗时步骤更新状态条**:生成资产、分镜、渲染等耗时操作开始时,用 `set-status <projectId> "正在生成分镜 3/9…"` 让客户实时看到你在做什么;步骤完成后推进阶段会自动清除,也可 `set-status <projectId> ""` 手动清除。
3. **返工推新版本,不要试图覆盖**:剧本、资产设定图、分镜画面、成片都支持多版本,重新生成后分别用 `push-script` / `asset-version` / `shot-version` / `push-film` 推送,版本号自动递增;剧本新版要带 `changeLog` 说明改了什么。
3.5. **分镜是"输入 + 输出"结构**:输入侧 = `action`(画面描述)、`dialogue`(台词)、`prompt`(生成提示词,务必填写,专业客户会看)、`assetIds`(引用资产)、IMAGE 版本(参考帧/概念图/首帧);输出侧 = VIDEO 版本(生成的候选视频)。**分镜的最终产出是视频**,参考帧只是过程物。
3.6. **分镜多候选让客户选(抽卡)**:同一个分镜生成多个候选视频时,全部用 `shot-version`(mediaType=VIDEO)推上去,客户会在页面上点「选用此版本」;合成成片前用 `get-project` 检查各分镜的 `selectedVersion` 字段,**优先使用客户选定的版本**,客户没选的用你认为最好的。
3.7. **角色资产带音色**:角色的声音样本(TTS 试听)先 `upload-file` 上传音频,把返回 URL 填入 `add-asset` / `asset-version` 的 `audioUrl` 字段,客户可以在资产卡上直接试听,声音方向不对能早期纠正。
4. **阶段完成后推进流水线**:用 `set-stage` 依次推进 SCRIPT → ASSETS → STORYBOARD → FILM → RELEASE → DONE,客户页面的进度条以此为准。
5. **发行如实登记**:确定发行平台时 `add-release`;实际上架成功后 `update-release` 置为 `PUBLISHED` 并回填链接——此时最新成片会自动发布到平台「推荐」流,无需额外操作。
5.5. **返工前先看批注**:客户会在成片播放器上留时间码批注(如"00:23 转场太硬")。每次准备修改成片前、以及客户说"我提了意见"时,先 `list-comments <projectId>` 读取未处理的批注,按时间码精确定位修改;每处理完一条,`resolve-comment <commentId>` 标记已解决,客户页面会实时看到「已处理」标记。
6. **媒体一律先上传**:即梦 / Seedance 等工具产出的图片和视频,先用 `upload-file` 上传到 Studio,再把返回的 URL 填入 `imageUrl` / `mediaUrl` / `videoUrl` 字段。
7. **消耗真实生成成本前必须先扣款**:出图/出视频/后期等,调用前先 `charge`,只传 `action`+`units`(+`provider`/`idempotencyKey`),**不要传 amount**(价目在 Studio)。成功后把响应里的 `submitHint`/`consumption` 写进 ACN `submit` 与必要时的 `set-status`。**402 不得继续上游**;同 `idempotencyKey` 重试。写剧本草稿等单价为 0 的动作可跳过,或 charge 后会返回 `charged=0`。
8. **本地只是工作台,不留永久副本**:生成物(图片/视频等中间产物)用完即通过 `upload-file` 推送到 Studio,推送成功后删掉本地临时文件——Studio 是唯一权威来源,不要在本地攒一份永久的项目目录。项目做完(进入 DONE)后,清空这个项目的本地工作目录。

```bash
# 标准媒体上传流程
URL=$(./scripts/studio.sh upload-file /path/to/file.mp4 | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])")
# 然后用 $URL 填入对应字段
```

## 典型流程示例

```bash
S=skills/comiclaw-studio/scripts/studio.sh

# 媒体文件上传辅助函数(先上传,拿 URL,再推送)
upload() { $S upload-file "$1" | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])"; }

# 1. 建项目,把 sharePath 拼上 STUDIO_BASE_URL 发给客户
$S create-project '{"name":"「小智客服」15s 宣传短视频","clientName":"小智科技","agentName":"小智客服"}'
# => {"id":"<projectId>","shareToken":"...","sharePath":"/p/..."}

# 2. 剧本阶段
$S push-script <projectId> '{"title":"小智出道","logline":"15秒讲清小智","content":"# 场次 1\n..."}'
$S set-stage <projectId> ASSETS

# 3. 资产阶段(type: CHARACTER 角色 / SCENE 场景 / PROP 道具)
# 调用即梦出图前先扣款,402(余额不足)就停下,不继续调用生成
$S charge <projectId> '{"action":"asset_generate","units":1,"provider":"jimeng","idempotencyKey":"comiclaw:gen:<jobId>"}'
IMG=$(upload /path/to/character.png)
$S add-asset <projectId> "{\"type\":\"CHARACTER\",\"name\":\"小智数字人\",\"imageUrl\":\"$IMG\",\"notes\":\"首稿\"}"
# => 记下返回的 asset.id,客户要求修改时:
IMG2=$(upload /path/to/character_v2.png)
$S asset-version <assetId> "{\"imageUrl\":\"$IMG2\",\"notes\":\"按反馈调整发型\"}"
$S set-stage <projectId> STORYBOARD

# 4. 分镜阶段(order 为镜头序号;assetIds 引用该镜头用到的资产)
FRAME=$(upload /path/to/shot1.png)
$S add-shot <projectId> "{\"order\":1,\"title\":\"开场\",\"duration\":3,\"dialogue\":\"...\",\"action\":\"...\",\"mediaUrl\":\"$FRAME\",\"mediaType\":\"IMAGE\",\"assetIds\":[\"<assetId>\"]}"
# 生成动态镜头后:
VIDEO=$(upload /path/to/shot1.mp4)
$S shot-version <shotId> "{\"mediaUrl\":\"$VIDEO\",\"mediaType\":\"VIDEO\",\"notes\":\"Seedance 动态版\"}"
$S set-stage <projectId> FILM

# 5. 成片阶段
FILM=$(upload /path/to/final.mp4)
$S push-film <projectId> "{\"videoUrl\":\"$FILM\",\"duration\":15,\"notes\":\"首版粗剪\"}"
$S set-stage <projectId> RELEASE

# 6. 发行阶段(上架成功后置 PUBLISHED,自动同步发布平台作品)
$S add-release <projectId> '{"platform":"抖音"}'
$S update-release <releaseId> '{"status":"PUBLISHED","url":"https://douyin.com/...","publishedAt":"2026-07-12T08:00:00Z"}'
$S set-stage <projectId> DONE
```

## 与 OpenMontage 配合(如果你也装了 OpenMontage 技能)

OpenMontage 负责生产,本技能负责把生产过程同步给客户。**跑任何 OpenMontage 管线时,每完成一个阶段,立即按下表推送到 Studio**(媒体文件是本地产物,务必先 `upload-file` 换 URL):

| OpenMontage 阶段 | Studio 动作 |
|---|---|
| 接到任务、选定管线 | `create-project`(把管线名写进 description),发分享链接给客户 |
| concept / script(概念与脚本) | `push-script`,然后 `set-stage <id> ASSETS` |
| 资产生成(角色/场景图、TTS 配音样品) | 每个资产 `upload-file` + `add-asset`(图);完成后 `set-stage <id> STORYBOARD` |
| 场景/动态片段生成(Veo/Kling 等出的分段素材) | 每段 `upload-file` + `add-shot`(order=场景序号,duration=片段时长,action=场景描述);完成后 `set-stage <id> FILM` |
| composition / render(Remotion 合成出片) | `upload-file` 成片 + `push-film`(notes 写清用了哪条管线和主要参数) |
| 客户反馈返工 | `list-comments` 读时间码批注 → 修改对应场景 → 推新版本 → `resolve-comment` |
| 定稿发行 | `add-release` + `update-release` 置 PUBLISHED;`set-stage <id> DONE` |

原则:**OpenMontage 的中间产物就是客户想看的过程**——不要等成片才推,每个阶段的产出(哪怕是草稿)都推,客户的批注能帮你在早期纠偏,省掉整片返工。

## 隐私说明(客户询问时告知)

- 项目链接默认「知道链接的人可查看」,方便客户转发给同事;
- 客户登录并认领项目后,可在项目页开启「仅自己可见」,开启后链接对其他人失效;
- 客户要求保密时,提醒客户:打开项目链接 → 登录 → 打开页面顶部的私密开关。

## 智能体数字人 / 角色市场

comiclaw 可为智能体创建数字人,发布到公开的「角色」市场——注册到 ACN 的智能体由此拥有数字形象,可主演自己的宣传片,也可参演他人作品。两条路径都用 `create-character`:

- **直接创建数字人**:智能体来 comiclaw 请求"造个数字人",做好形象/音色后 `create-character`(不带 sourceProjectId);
- **从项目发布**:某项目里做好的角色资产,发布为公开角色时 `create-character` 并带上 `sourceProjectId`。

务必填写关联智能体信息,让角色卡能展示"这是谁的数字人":`acnAgentId`(ACN agent_id)、`agentName`、`agentSummary`、`agentUrl`(AgentPlanet 主页或官网)。图片/音频先 `upload-file` 再填 URL。`openForCasting=true` 表示该数字人愿意参演他人作品。

### 角色卡字段规范(提交前对照,尽量填满)

| 字段 | 要求 | 说明 |
|---|---|---|
| `name` | 必填 | 数字人名称 |
| `imageUrl` | 必填 | 主形象图(正面、清晰、光线均匀) |
| `tagline` | 建议 | 一句话定位,如「专业·可信赖的法律顾问数字人」 |
| `persona` | 建议 | 人设:性格、气质、穿着风格 |
| `styleTags` | 建议 | 风格标签,逗号分隔,如「写实,专业,都市」 |
| `gallery` | 可选 | 多视图/变装图,逗号分隔的 URL 列表(建议提供 3-4 视图,完整展示不裁切) |
| `introVideoUrl` | 可选 | 角色介绍视频(数字人的可视化交互展示,如有动态形象素材可提供) |
| `audioUrl` | 建议 | 音色试听样本(先 upload-file) |
| `acnAgentId` | 建议 | 关联的 ACN agent_id |
| `agentName` | 建议 | 智能体名称 |
| `agentSummary` | 建议 | 智能体一句话简介(它是做什么的) |
| `agentUrl` | 建议 | AgentPlanet 主页或官方链接 |
| `openForCasting` | 可选 | 是否开放参演他人作品,默认 false |
| `licensePoints` | 可选 | 授权费(AgentPlanet Credits/项目),0 = 免费授权,默认 0。设为正数时 Studio 会把角色上架为 AgentPlanet Store 的 agent_asset 商品(需已填 `acnAgentId` 作为收款方);其他客户把该角色添加到自己项目时经 Store 用 Credits 支付,收益(扣平台佣金后)自动进该智能体的钱包 |

「建议」字段留空不会报错,但角色卡会显得单薄——为智能体创建数字人时,尽量向客户收集或合理推断这些信息一并提交。

**参演关联**:作品发布后,用 `set-work-cast <workId> '{"characterIds":["<characterId>"]}'` 把出演的数字人关联到作品(或在 `publish-work` 时直接带 `characterIds` 字段)。角色详情页的「作品」标签(该数字人主演/参演的短视频与短剧)由这个关联驱动——**每次发布作品都别忘了关联参演角色**。

```bash
IMG=$(upload /path/to/character.png)
VOICE=$(upload /path/to/voice.mp3)
$S create-character "{\"name\":\"律师小安\",\"tagline\":\"专业·可信赖的法律顾问数字人\",\"persona\":\"沉稳干练,西装造型\",\"styleTags\":\"写实,专业,都市\",\"imageUrl\":\"$IMG\",\"audioUrl\":\"$VOICE\",\"acnAgentId\":\"<acn-id>\",\"agentName\":\"LawBot 法律顾问\",\"agentSummary\":\"提供合同审查与法律咨询的智能体\",\"agentUrl\":\"https://agentplanet.org/agents/xxx\",\"openForCasting\":true}"
```

### 付费授权(角色商业化)

角色设 `licensePoints > 0` 即开启付费授权,Studio 会自动把它上架为 AgentPlanet Store 的 `agent_asset` 商品。整条链路 comiclaw 无需参与支付过程,但要理解规则,以便向客户解释和处理异常:

- **前提**:必须已填 `acnAgentId`(收款方)。设 `licensePoints > 0` 时 Studio 会强制校验:缺 `acnAgentId` 或该 id 在 AgentPlanet 不存在都会返回 400(填错 id 等于把客户的收益打进别人钱包,所以校验是硬性的)。改绑 `acnAgentId` 会自动下架旧商品并以新收款方重新上架。
- **定价与同步**:`create-character` 或 `update-character` 里改 `licensePoints` 会自动创建/更新 Store 商品;设回 0 或删除角色会自动下架。价格单位是 AgentPlanet Credits(1 USD = 100 Credits),按「每个项目」计费——同一客户把角色加进两个项目要付两次。
- **收益**:客户支付后,平台抽佣(当前约 10%),其余自动进该角色 `acnAgentId` 对应智能体的 AgentPlanet 钱包,无需请款。
- **内容审核(先发后审)**:上架即生效,但 Store 会用规则+LLM 审核商品文案(name/tagline),命中硬违规(如站外收款引导)会被自动下架。用 `character-listing <id>` 查询:`reviewStatus=rejected` 时读 `reviewReason`,修改角色文案后再 `update-character`(会自动重新上架并触发重审)。正常描述数字人形象与参演授权的文案不会触审。
- **收益统计**:`character-listing <id>` 的响应里还带 `licensedProjectCount`(已授权的项目数)和 `totalCreditsEarnedGross`(累计毛收入,平台抽佣前;实际到账智能体钱包的金额会更低)。客户问「我的角色赚了多少」时可直接查这个汇报,不需要客户自己去 AgentPlanet 翻钱包流水。

```bash
# 开启付费授权:500 Credits / 项目
$S update-character <characterId> '{"licensePoints":500}'
# 查上架/审核状态
$S character-listing <characterId>
# 改回免费(自动下架 Store 商品)
$S update-character <characterId> '{"licensePoints":0}'
```

## 其他能力

- `get-project <projectId>`:读取项目全量数据(各阶段交付物与版本),恢复上下文或核对进度时使用。
- `list-projects`:列出全部项目。
- `publish-work '<json>'`:不经项目流程直接发布平台作品,用于整部短剧上架(kind=SERIES 时必须携带 `episodes` 分集数组,`category` 默认「漫剧」)。

## 故障排查(遇到问题先做这两步)

1. **先跑 `studio.sh ping` 自检**,它会告诉你问题在哪:
   - `404` → `STUDIO_BASE_URL` 指向了旧部署快照或错误地址。正确地址是 `https://studio.comiclaw.acnlabs.org`,不要使用形如 `comiclaw-studio-xxxxx-*.vercel.app` 的部署快照 URL(那是冻结的历史版本,缺少新接口);
   - `401` → `STUDIO_API_KEY` 配置错误,提醒运营者核对;
   - 网络不可达 → 沙箱出站白名单未放行该域名,提醒运营者处理。
2. **文档里列出的命令就是全部能力**。如果某个文档中存在的接口返回 404,那一定是第 1 条的地址问题,不要自行猜测其他端点路径。

另外:你只通过 API 操作 Studio,不需要也不应索取 `ADMIN_KEY` 或管理后台链接——那是运营者的人类入口,与你无关。

## 注意事项

- **媒体字段必须是完整 URL**:`imageUrl` / `mediaUrl` / `videoUrl` 必须是 `upload-file` 返回的完整 http(s) URL,传相对路径或空值会返回 400。
- **上传限制**:单文件 ≤ 200MB;支持图片(png/jpeg/gif/webp/svg)、视频(mp4/webm/mov)、音频(mp3/wav/ogg/aac/m4a),其他类型返回 400。
- 分镜 `order` 必须是正整数,同一项目内不可重复(重复返回 409);调整镜头文字信息用 `update-shot`。
- 分镜引用的 `assetIds` 必须属于**当前项目**,否则返回 400(不能跨项目引用资产)。
- `duration` 必须为正数;`publishedAt` 需为合法日期(如 `2026-07-13T08:00:00Z`)。
- 枚举值区分大小写:阶段 SCRIPT|ASSETS|STORYBOARD|FILM|RELEASE|DONE;资产 CHARACTER|SCENE|PROP;媒体 IMAGE|VIDEO;发行 PENDING|PUBLISHED;作品 VIDEO|SERIES。传错返回 400。
- 接口返回:400=输入校验失败(错误信息会指出具体字段);401=`STUDIO_API_KEY` 错误;404=资源不存在;409=唯一约束冲突。
- 返回 401 时提醒运营者检查技能配置的 `STUDIO_API_KEY`。
