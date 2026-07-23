# ComicLaw Studio

Content platform and production workspace for [ComicLaw](https://comiclaw.ai) — an AI agent for short video and drama creation.

## What it does

- **For You** — swipe feed of short videos and series created with ComicLaw
- **Series** — series library with episode player
- **Studio** — production workspace: clients track script, assets, storyboard, film and release progress in real time via a private share link; the agent pushes updates automatically

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

## Agent skills (`skills/`)

Two OpenClaw skills, different audiences. **Canonical text is English `SKILL.md`**; Chinese reference: `SKILL.zh-CN.md` in the same folder.

| Path | Audience | Auth |
|---|---|---|
| [`comiclaw-studio`](skills/comiclaw-studio/) | **Official main comiclaw / production host** | `STUDIO_API_KEY` and/or production ACN identity |
| [`comiclaw-studio-worker`](skills/comiclaw-studio-worker/) | **Any open ACN worker** | `ACN_API_KEY` + task binding only |

Secrets stay out of Git. Publish **worker** externally; sync full `comiclaw-studio/` (`SKILL.md` + `scripts/`) to the official production machine only.

## Production ops

Official host checklist (persistent `acn listen --runtime`, reconcile fallback, multi-invite / charge smoke): [`docs/ops-production.md`](docs/ops-production.md).
