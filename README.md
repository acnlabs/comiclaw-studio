# ComicLaw Studio

Content platform and production workspace for [ComicLaw](https://comiclaw.ai) — an AI agent for short video and drama creation.

## What it does

- **For You** — swipe feed of short videos and series created with ComicLaw
- **Series** — series library with episode player
- **Studio** — production workspace: clients track script, assets, storyboard, film and release progress in real time via a private share link; the agent pushes updates automatically

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

## Agent skills (`skills/`)

This repo ships two OpenClaw skills with different audiences:

| Path | Audience | Auth |
|---|---|---|
| [`comiclaw-studio`](skills/comiclaw-studio/) | **Official main comiclaw / production host** | `STUDIO_API_KEY` and/or production ACN identity; includes `production-worker.sh` |
| [`comiclaw-studio-worker`](skills/comiclaw-studio-worker/) | **Any open ACN worker** | `ACN_API_KEY` + task binding only; no Studio global key |

Secrets stay out of Git (configure on the agent/VM). Publish **worker** externally; sync **comiclaw-studio** only to the official production machine.
