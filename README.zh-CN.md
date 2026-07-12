# ComicLaw Studio

[English](README.md) | 简体中文

**ComicLaw** 的内容平台与创作工作台 — 一个负责短视频和短剧全流程制作的对话式 AI 智能体。智能体在制作过程中通过 REST API 将交付物推送到 Studio;客户通过专属分享链接实时查看剧本、资产、分镜与成片(SSE 自动刷新);发行上架的作品自动同步发布到平台前台展示。

## 站点结构

| 菜单 | 路径 | 内容 |
|------|------|------|
| 推荐 | `/` | 滑动观看的作品流(短视频 + 短剧,横竖版自适应,自动播放) |
| 短剧 | `/series` | 短剧库,子类目前仅「漫剧」;详情页(`/series/<id>`)带分集播放 |
| Studio | `/studio` | 工作台入口:品牌介绍;携带 `?key=<ADMIN_KEY>` 显示全部项目(管理视图) |
| 项目工作台 | `/p/<shareToken>` | 客户专属链接,查看单个项目全流程交付物 |

**发行同步**:项目发行记录状态变为 `PUBLISHED` 时,最新成片自动发布为平台作品(幂等,同一项目只对应一个作品),出现在「推荐」流。整部短剧可通过 `POST /api/agent/works` 直接发布。

## 工作流与页面

固定五阶段流水线:**剧本 → 资产 → 分镜 → 成片 → 发行**

| 面板 | 内容 |
|------|------|
| 流水线头部 | 项目信息 + 当前阶段进度 |
| 剧本 | 分场剧本(Markdown 渲染),多版本切换,含改动说明 |
| 资产 | 角色 / 场景 / 道具设定卡,多版本设定图 |
| 分镜 | 镜头网格:画面(图/视频)、时长、台词、画面描述、引用资产 |
| 成片 | 视频播放器 + 版本历史与剪辑说明 |
| 发行 | 各平台上架状态与观看链接 |

## 技术栈

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

实时推送采用 SSE,搭配 30 秒轮询兜底(Serverless 部署下 SSE 跨实例不可达时仍能更新)。

**国际化**:界面支持中文 / 英文,右上角手动切换(cookie,一年有效),首次访问按 `Accept-Language` 自动判断;不使用 URL 前缀,分享链接在两种语言下通用。词条在 `src/lib/i18n.ts` 集中维护。智能体推送的内容(剧本正文、作品标题等)不做自动翻译。

## 本地开发

```bash
npm install
# 准备一个 PostgreSQL 实例并在 .env 中配置 DATABASE_URL
npx prisma migrate dev   # 初始化数据库
npm run db:seed          # 写入演示项目
npm run dev
```

打开 <http://localhost:3000/p/demo> 查看演示项目。

环境变量(见 `.env.example`):

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串,如 `postgresql://studio:studio@localhost:5432/studio` |
| `STUDIO_API_KEY` | Agent 推送接口的 Bearer Key,生产环境务必改为强随机值 |
| `ADMIN_KEY` | 项目列表的管理密钥:访问 `/studio?key=<ADMIN_KEY>` 可见全部项目;不设置则任何人都看不到 |

### 访问隔离

每个项目有一个不可猜测的 `shareToken`,客户只能通过专属链接 `/p/<shareToken>` 查看自己的项目。Studio 页对普通访客仅显示品牌介绍,带管理密钥才显示项目列表。

## Agent API

所有 `/api/agent/*` 接口需要请求头 `Authorization: Bearer <STUDIO_API_KEY>`,请求体为 JSON。

| 方法 | 路径 | 作用 | 关键字段 |
|------|------|------|----------|
| POST | `/api/agent/projects` | 创建项目,返回 `sharePath` | `name`*, `clientName`, `agentName`, `description`, `coverUrl` |
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
| PATCH | `/api/agent/releases/:releaseId` | 更新发行状态(PUBLISHED 时自动同步发布作品) | `status`(PENDING/PUBLISHED), `url`, `publishedAt` |
| POST | `/api/agent/works` | 直接发布平台作品(如整部短剧) | `kind`*(VIDEO/SERIES), `title`*, `category`, `videoUrl`, `coverUrl`, `description`, `authorName`, `episodes[]`(order/title/videoUrl/duration) |

示例:创建项目并推送剧本

```bash
KEY="your-api-key"; BASE="http://localhost:3000"

PID=$(curl -s -X POST $BASE/api/agent/projects \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"Aria 15s promo","clientName":"Aria Inc.","agentName":"Aria"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

curl -s -X POST $BASE/api/agent/projects/$PID/script-versions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"title":"Aria debuts","logline":"Aria in 15 seconds","content":"# Scene 1\n..."}'
```

媒体文件以 URL 引用,任何 AI 图像/视频生成工具的产出链接直接可用。

## 部署

### Vercel + Neon(免费档即可)

1. **仓库**:Vercel 免费档(Hobby)支持 GitHub 组织的**公开**仓库直接部署(私有组织仓库需 Pro;也可镜像到个人仓库)。
2. **数据库**:在 [neon.tech](https://neon.tech) 创建免费 PostgreSQL,拿到连接串。
3. **导入部署**:Vercel 控制台导入仓库(自动识别 Next.js;`vercel-build` 脚本自动执行数据库迁移),配置环境变量:`DATABASE_URL`、`STUDIO_API_KEY`、`ADMIN_KEY`。
4. (可选)本地把 `DATABASE_URL` 指向 Neon,执行 `npm run db:seed` 写入演示数据。

> Vercel Serverless 下 SSE 跨实例不可达,页面靠 30s 轮询兜底更新,展示场景足够。

### 自托管(Docker Compose)

```bash
STUDIO_API_KEY="<强随机值>" ADMIN_KEY="<强随机值>" POSTGRES_PASSWORD="<强随机值>" \
  docker compose up -d --build
```

一条命令拉起应用 + PostgreSQL,启动时自动执行数据库迁移。

## 智能体接入

预期的工作闭环:智能体通过 API 创建项目并向客户发送分享链接(`<studio 域名>/p/<shareToken>`);制作过程中逐阶段推送交付物;客户实时查看进度;发行上架后作品自动出现在推荐流。

现成的技能包在 [`skills/comiclaw-studio/`](skills/comiclaw-studio/):

- `SKILL.md`:工作流规范——先建项目发链接,逐阶段立即推送,返工推新版本,推进阶段,登记发行;
- `scripts/studio.sh`:API 的命令行封装,`studio.sh help` 查看全部命令。

接入方式:把 `skills/comiclaw-studio/` 放入智能体的 skills 目录,配置 `STUDIO_BASE_URL` 与 `STUDIO_API_KEY`。

## 目录结构

```
prisma/                 # 数据模型、迁移、演示 seed
src/lib/                # Prisma 单例、事件总线、认证、发行同步、国际化、类型
src/app/api/agent/      # Agent 推送接口(Bearer Key 认证)
src/app/api/projects/   # 客户侧 SSE 接口
src/app/page.tsx        # 推荐(作品流)
src/app/series/         # 短剧库与详情页(分集播放)
src/app/studio/         # Studio 入口(品牌页 / 管理视图)
src/app/p/[token]/      # 客户工作台(免登录分享链接)
src/components/         # 全站导航、作品卡片/播放器、流水线头部、五个面板
skills/                 # 智能体技能包
scripts/                # 占位图生成、页面截图
```
