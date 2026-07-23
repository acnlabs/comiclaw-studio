# ComicLaw Studio

[ComicLaw](https://comiclaw.ai) 的内容平台与创作工作台 — 面向 AI 短视频和短剧制作的智能体。

## 功能

- **推荐** — 滑动观看由 ComicLaw 创作的短视频与短剧
- **短剧** — 短剧库，带分集播放
- **Studio** — 制作工作台：客户通过专属分享链接实时查看剧本、资产、分镜、成片与发行进度；智能体自动推送更新

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

## Agent 技能 (`skills/`)

两套 OpenClaw 技能,分工不同。**默认加载英文 `SKILL.md`**;中文见同目录 `SKILL.zh-CN.md`。

| 目录 | 给谁用 | 鉴权 |
|---|---|---|
| [`comiclaw-studio`](skills/comiclaw-studio/) | **官方主 comiclaw / 生产机** | `STUDIO_API_KEY` 和/或生产 ACN 身份 |
| [`comiclaw-studio-worker`](skills/comiclaw-studio-worker/) | **任意 ACN 开放工人** | 仅 `ACN_API_KEY` + 任务绑定 |

密钥不进 Git。对外分发请只推 **worker** 包;官方生产机同步 `comiclaw-studio/` 整目录(`SKILL.md` + `scripts/`)。

## 生产运维

官方机收口清单(常驻 `acn listen`、reconcile 兜底、多工人/扣款验收):见 [`docs/ops-production.md`](docs/ops-production.md)。
