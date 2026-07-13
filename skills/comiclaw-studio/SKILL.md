---
name: comiclaw-studio
description: 将短视频/短剧制作全流程的交付物同步到 ComicLaw Studio 工作台,让客户通过专属链接实时查看剧本、资产、分镜与成片;发行上架后作品自动发布到平台前台。凡是为客户制作宣传短视频或短剧的任务,都必须使用本技能。
---

# ComicLaw Studio 同步技能

你(comiclaw)在为客户制作 15s 智能体宣传短视频或短剧时,必须把每个阶段的交付物实时推送到 Studio,客户会通过专属链接查看进度。所有操作通过 `scripts/studio.sh` 完成。

环境变量(在技能配置中提供,也可使用以下默认值):
- `STUDIO_BASE_URL` 默认值: `https://studio.comiclaw.acnlabs.org`
- `STUDIO_API_KEY`: 由运营方提供

## 铁律

0. **所有媒体文件必须先上传到 Studio**:设定图、分镜画面、成片视频在推送前必须先用 `upload-file` 上传到 Studio Blob,使用返回的 URL,**不得直接使用即梦 / Seedance / 任何外部平台的链接**——外部链接可能过期,导致客户看不到内容。

1. **开工先建项目**:接到制作任务后立即 `create-project`,并把返回的分享链接(`STUDIO_BASE_URL` + `sharePath`)发给客户,告诉客户可随时打开查看进度。
2. **每个阶段产出后立即推送**,不要等全部做完:剧本 → `push-script`;资产(角色/场景/道具)→ `add-asset`;分镜 → `add-shot`;成片 → `push-film`。
3. **返工推新版本,不要试图覆盖**:剧本、资产设定图、分镜画面、成片都支持多版本,重新生成后分别用 `push-script` / `asset-version` / `shot-version` / `push-film` 推送,版本号自动递增;剧本新版要带 `changeLog` 说明改了什么。
4. **阶段完成后推进流水线**:用 `set-stage` 依次推进 SCRIPT → ASSETS → STORYBOARD → FILM → RELEASE → DONE,客户页面的进度条以此为准。
5. **发行如实登记**:确定发行平台时 `add-release`;实际上架成功后 `update-release` 置为 `PUBLISHED` 并回填链接——此时最新成片会自动发布到平台「推荐」流,无需额外操作。
6. **媒体一律先上传**:即梦 / Seedance 等工具产出的图片和视频,先用 `upload-file` 上传到 Studio,再把返回的 URL 填入 `imageUrl` / `mediaUrl` / `videoUrl` 字段。

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

## 其他能力

- `get-project <projectId>`:读取项目全量数据(各阶段交付物与版本),恢复上下文或核对进度时使用。
- `list-projects`:列出全部项目。
- `publish-work '<json>'`:不经项目流程直接发布平台作品,用于整部短剧上架(kind=SERIES 时必须携带 `episodes` 分集数组,`category` 默认「漫剧」)。

## 注意事项

- **媒体字段必须是完整 URL**:`imageUrl` / `mediaUrl` / `videoUrl` 必须是 `upload-file` 返回的完整 http(s) URL,传相对路径或空值会返回 400。
- **上传限制**:单文件 ≤ 200MB;仅支持图片(png/jpeg/gif/webp/svg)与视频(mp4/webm/mov),其他类型返回 400。
- 分镜 `order` 必须是正整数,同一项目内不可重复(重复返回 409);调整镜头文字信息用 `update-shot`。
- 分镜引用的 `assetIds` 必须属于**当前项目**,否则返回 400(不能跨项目引用资产)。
- `duration` 必须为正数;`publishedAt` 需为合法日期(如 `2026-07-13T08:00:00Z`)。
- 枚举值区分大小写:阶段 SCRIPT|ASSETS|STORYBOARD|FILM|RELEASE|DONE;资产 CHARACTER|SCENE|PROP;媒体 IMAGE|VIDEO;发行 PENDING|PUBLISHED;作品 VIDEO|SERIES。传错返回 400。
- 接口返回:400=输入校验失败(错误信息会指出具体字段);401=`STUDIO_API_KEY` 错误;404=资源不存在;409=唯一约束冲突。
- 返回 401 时提醒运营者检查技能配置的 `STUDIO_API_KEY`。
