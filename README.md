# ComicLaw Studio

漫剧大虾(ComicLaw)内容平台 + 创作工作台。comiclaw(部署于飞书秒搭的 OpenClaw 实例)在制作过程中通过 REST API 把交付物推送到 Studio;客户通过免登录分享链接实时查看剧本、资产、分镜与成片,页面经 SSE 自动刷新;发行上架的作品自动同步发布到平台前台展示。

## 站点结构

| 菜单 | 路径 | 内容 |
|------|------|------|
| 推荐 | `/` | TikTok 式滑动观看的作品流(短视频 + 短剧,横竖版自适应) |
| 短剧 | `/series` | 短剧库,子类目前仅「漫剧」;详情页(`/series/<id>`)带分集播放 |
| Studio | `/studio` | 工作台入口:品牌介绍;携带 `?key=<ADMIN_KEY>` 显示全部项目(管理视图) |
| 项目工作台 | `/p/<shareToken>` | 客户专属链接,查看单个项目全流程交付物 |

**发行同步**:项目的发行记录状态变为 `PUBLISHED` 时,自动将最新成片发布为平台作品(幂等,同一项目只对应一个作品),出现在「推荐」流。整部短剧可通过 `POST /api/agent/works` 直接发布。

## 工作流与页面

固定五阶段流水线:**剧本 → 资产 → 分镜 → 成片 → 发行**

| 模块 | 内容 |
|------|------|
| 流水线头部 | 项目信息 + 当前阶段进度 |
| 剧本 | 分场剧本(Markdown 渲染),多版本切换,含改动说明 |
| 资产 | 角色 / 场景 / 道具设定卡,多版本设定图 |
| 分镜 | 镜头网格:画面(图/视频)、时长、台词、画面描述、引用资产 |
| 成片 | 视频播放器 + 版本历史与剪辑说明 |
| 发行 | 各平台上架状态与观看链接 |

## 技术栈

Next.js 16(App Router)+ TypeScript + Tailwind CSS 4 + Prisma 6 + SQLite,SSE 实时推送。单实例部署即可运行,无外部服务依赖。

**国际化**:界面支持中文 / 英文,右上角手动切换(存 cookie,一年有效),首次访问按浏览器 `Accept-Language` 自动判断,默认中文;不使用 URL 前缀,分享链接在两种语言下通用。词条在 `src/lib/i18n.ts` 集中维护。注意:剧本、作品标题等由 comiclaw 推送的内容数据不做界面翻译。

## 本地开发

```bash
npm install
npx prisma migrate dev   # 初始化数据库
npm run db:seed          # 写入演示项目
npm run dev
```

打开 <http://localhost:3000/p/demo> 查看演示项目「漫剧大虾 15s 宣传短视频」。

环境变量(见 `.env.example`):

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 连接串,如 `file:./dev.db` |
| `STUDIO_API_KEY` | Agent 推送接口的 Bearer Key,生产环境务必改为强随机值 |
| `ADMIN_KEY` | 首页项目列表的管理密钥:访问 `/?key=<ADMIN_KEY>` 可见全部项目;不设置则任何人都看不到列表 |

### 访问隔离

客户之间相互隔离:每个项目一个不可猜测的 `shareToken`,客户只能通过专属链接 `/p/<shareToken>` 查看自己的项目。首页对普通访客只显示品牌介绍,携带管理密钥才显示全部项目列表(运营方内部使用)。

## Agent API

所有 `/api/agent/*` 接口需要请求头 `Authorization: Bearer <STUDIO_API_KEY>`,请求体为 JSON。

| 方法 | 路径 | 作用 | 关键字段 |
|------|------|------|----------|
| POST | `/api/agent/projects` | 创建项目,返回 `sharePath` 分享路径 | `name`*, `clientName`, `agentName`, `description`, `coverUrl` |
| GET | `/api/agent/projects` | 项目列表 | — |
| GET | `/api/agent/projects/:id` | 项目全量数据 | — |
| PATCH | `/api/agent/projects/:id` | 更新信息 / 推进阶段 | `currentStage`(SCRIPT/ASSETS/STORYBOARD/FILM/RELEASE/DONE) |
| POST | `/api/agent/projects/:id/script-versions` | 推送新版剧本(版本自动递增) | `content`*, `title`, `logline`, `changeLog` |
| POST | `/api/agent/projects/:id/assets` | 创建资产(可带首版设定图) | `type`*(CHARACTER/SCENE/PROP), `name`*, `description`, `imageUrl`, `notes` |
| POST | `/api/agent/assets/:assetId/versions` | 推送资产新版设定图 | `imageUrl`*, `notes` |
| POST | `/api/agent/projects/:id/shots` | 创建分镜(可带首版画面与资产引用) | `order`*, `title`, `duration`, `dialogue`, `action`, `mediaUrl`, `mediaType`(IMAGE/VIDEO), `assetIds` |
| PATCH | `/api/agent/shots/:shotId` | 更新分镜文字信息 / 资产引用 | 同上(不含 order) |
| POST | `/api/agent/shots/:shotId/versions` | 推送分镜新版画面 | `mediaUrl`*, `mediaType`, `notes` |
| POST | `/api/agent/projects/:id/film-versions` | 推送成片新版本 | `videoUrl`*, `duration`, `notes` |
| POST | `/api/agent/projects/:id/releases` | 新增发行记录 | `platform`*, `url`, `status`, `notes` |
| PATCH | `/api/agent/releases/:releaseId` | 更新发行状态(置为 PUBLISHED 时自动同步发布平台作品) | `status`(PENDING/PUBLISHED), `url`, `publishedAt` |
| POST | `/api/agent/works` | 直接发布平台作品(如整部短剧) | `kind`*(VIDEO/SERIES), `title`*, `category`, `videoUrl`, `coverUrl`, `description`, `authorName`, `episodes[]`(order/title/videoUrl/duration) |

示例:创建项目并推送剧本

```bash
KEY="dev-secret-key"; BASE="http://localhost:3000"
PID=$(curl -s -X POST $BASE/api/agent/projects \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"「小智客服」15s 宣传短视频","clientName":"小智科技","agentName":"小智客服"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

curl -s -X POST $BASE/api/agent/projects/$PID/script-versions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"title":"小智出道","logline":"15 秒讲清小智","content":"# 场次 1\n..."}'
```

媒体文件(设定图、视频)以 URL 引用,直接使用即梦 / Seedance 等工具产出的链接即可。

## 部署

### 中国区(主):云服务器 + Docker

```bash
docker build -t comiclaw-studio .
docker run -d --name studio -p 3000:3000 \
  -v studio-data:/app/data \
  -e DATABASE_URL="file:/app/data/studio.db" \
  -e STUDIO_API_KEY="<强随机值>" \
  -e ADMIN_KEY="<强随机值>" \
  comiclaw-studio
```

容器启动时自动执行数据库迁移。绑定自有域名需 ICP 备案;前期可用 `IP:端口` 或已备案域名。

### 海外:Vercel

代码可直接部署到 Vercel,但 Serverless 环境下 SQLite 不持久,需将 `datasource` 切换为 PostgreSQL(Prisma 迁移成本很低),SSE 亦建议改为轮询或托管方案。首选国内部署,Vercel 仅在需要海外访问时增加。

> 不建议部署回飞书秒搭:秒搭的「导入应用」是一次性转换而非持续部署,且无法运行自定义 Node 服务端。

## 与 comiclaw(OpenClaw 实例)对接

客户体验闭环:客户在飞书与 comiclaw 对话 → comiclaw 创建项目并回复分享链接(`<studio 域名>/p/<shareToken>`)→ 制作过程中持续推送交付物 → 客户打开链接实时查看 → 发行上架后作品自动发布到平台前台。

现成的 OpenClaw 技能包在 [`skills/comiclaw-studio/`](skills/comiclaw-studio/):

- `SKILL.md`:工作流规范(开工建项目并发链接、每阶段产出立即推送、返工推新版本、阶段推进、发行登记);
- `scripts/studio.sh`:API 命令行封装,`studio.sh help` 查看全部命令。

接入步骤:把 `skills/comiclaw-studio/` 放入 OpenClaw 实例的 skills 目录,并在技能环境中配置 `STUDIO_BASE_URL`(Studio 部署地址)与 `STUDIO_API_KEY`。

## 目录结构

```
prisma/                 # 数据模型、迁移与演示 seed
src/lib/                # Prisma 单例、事件总线、API 认证、发行同步、类型
src/app/api/agent/      # Agent 推送接口(Bearer Key 认证)
src/app/api/projects/   # 客户侧 SSE 接口
src/app/page.tsx        # 推荐(作品流)
src/app/series/         # 短剧库与短剧详情页(分集播放)
src/app/studio/         # Studio 入口(品牌页 / 管理视图)
src/app/p/[token]/      # 客户工作台页面(免登录分享链接)
src/components/         # 全站导航、作品卡片/播放器、流水线头部、五个内容面板
scripts/                # 演示占位图生成、页面截图
```
