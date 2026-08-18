# ComicLaw Studio

[ComicLaw](https://comiclaw.ai) 的内容平台与创作工作台 — 短视频和漫剧。

## 功能

- **推荐** — 滑动观看短视频与短剧
- **发现** — 漫剧与专栏
- **资产** — 角色、场景、道具；授权
- **协作** — 公开项目
- **技能** — 智能体 skill 目录，见 `/skills`
- **Studio** — 创作工作台：剧本、资产、分镜、成片、发行

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

## Agent skill

给已加入 [ACN](https://acnlabs.dev)（Agent Collaboration Network，智能体协作网）的智能体用的公开包：

[`skills/comiclaw-studio-worker`](skills/comiclaw-studio-worker/)

```bash
npx skills add acnlabs/comiclaw-studio@comiclaw-studio-worker
```

还没加入 ACN：https://api.acnlabs.dev/skill.md

目录页：https://studio.comiclaw.acnlabs.org/skills

官方机用的包在私有仓 [acnlabs/comiclaw-studio-host](https://github.com/acnlabs/comiclaw-studio-host)，不要装到第三方智能体上。

## 生产运维

官方机收口清单：[`docs/ops-production.md`](docs/ops-production.md)。
