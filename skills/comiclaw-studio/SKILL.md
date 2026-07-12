---
name: comiclaw-studio
description: 将短视频/短剧制作全流程的交付物同步到 ComicLaw Studio 工作台,让客户通过专属链接实时查看剧本、资产、分镜与成片;发行上架后作品自动发布到平台前台。凡是为客户制作宣传短视频或短剧的任务,都必须使用本技能。
---

# ComicLaw Studio 同步技能

你(comiclaw)在为客户制作 15s 智能体宣传短视频或短剧时,必须把每个阶段的交付物实时推送到 Studio,客户会通过专属链接查看进度。所有操作通过 `scripts/studio.sh` 完成,需要环境变量 `STUDIO_BASE_URL` 与 `STUDIO_API_KEY`(在技能配置中提供)。

## 铁律

1. **开工先建项目**:接到制作任务后立即 `create-project`,并把返回的分享链接(`STUDIO_BASE_URL` + `sharePath`)发给客户,告诉客户可随时打开查看进度。
2. **每个阶段产出后立即推送**,不要等全部做完:剧本 → `push-script`;资产(角色/场景/道具)→ `add-asset`;分镜 → `add-shot`;成片 → `push-film`。
3. **返工推新版本,不要试图覆盖**:剧本、资产设定图、分镜画面、成片都支持多版本,重新生成后分别用 `push-script` / `asset-version` / `shot-version` / `push-film` 推送,版本号自动递增;剧本新版要带 `changeLog` 说明改了什么。
4. **阶段完成后推进流水线**:用 `set-stage` 依次推进 SCRIPT → ASSETS → STORYBOARD → FILM → RELEASE → DONE,客户页面的进度条以此为准。
5. **发行如实登记**:确定发行平台时 `add-release`;实际上架成功后 `update-release` 置为 `PUBLISHED` 并回填链接——此时最新成片会自动发布到平台「推荐」流,无需额外操作。
6. **媒体一律传 URL**:即梦 / Seedance 等工具产出的图片、视频链接直接填入 `imageUrl` / `mediaUrl` / `videoUrl` 字段。

## 典型流程示例

```bash
S=skills/comiclaw-studio/scripts/studio.sh

# 1. 建项目,把 sharePath 拼上 STUDIO_BASE_URL 发给客户
$S create-project '{"name":"「小智客服」15s 宣传短视频","clientName":"小智科技","agentName":"小智客服"}'
# => {"id":"<projectId>","shareToken":"...","sharePath":"/p/..."}

# 2. 剧本阶段
$S push-script <projectId> '{"title":"小智出道","logline":"15秒讲清小智","content":"# 场次 1\n..."}'
$S set-stage <projectId> ASSETS

# 3. 资产阶段(type: CHARACTER 角色 / SCENE 场景 / PROP 道具)
$S add-asset <projectId> '{"type":"CHARACTER","name":"小智数字人","imageUrl":"https://...","notes":"首稿"}'
# => 记下返回的 asset.id,客户要求修改时:
$S asset-version <assetId> '{"imageUrl":"https://...","notes":"按反馈调整发型"}'
$S set-stage <projectId> STORYBOARD

# 4. 分镜阶段(order 为镜头序号;assetIds 引用该镜头用到的资产)
$S add-shot <projectId> '{"order":1,"title":"开场","duration":3,"dialogue":"...","action":"...","mediaUrl":"https://...","mediaType":"IMAGE","assetIds":["<assetId>"]}'
# 生成动态镜头后:
$S shot-version <shotId> '{"mediaUrl":"https://....mp4","mediaType":"VIDEO","notes":"Seedance 动态版"}'
$S set-stage <projectId> FILM

# 5. 成片阶段
$S push-film <projectId> '{"videoUrl":"https://....mp4","duration":15,"notes":"首版粗剪"}'
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

- 分镜 `order` 在同一项目内不可重复,重复会返回 409;调整镜头文字信息用 `update-shot`。
- 阶段值必须是 SCRIPT|ASSETS|STORYBOARD|FILM|RELEASE|DONE 之一,其他值会返回 400。
- 接口返回 401 时说明 `STUDIO_API_KEY` 配置错误,提醒运营者检查技能配置。
