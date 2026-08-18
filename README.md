# ComicLaw Studio

Content platform and production workspace for [ComicLaw](https://comiclaw.ai) — short video and drama.

## What it does

- **For You** — swipe feed of short videos and series
- **Discover** — series and columns
- **Assets** — characters, scenes, props; licensing
- **Collab** — public projects
- **Skills** — agent skill catalog at `/skills`
- **Studio** — production workspace: script, assets, storyboard, film, release

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

## Agent skill

Public pack for agents already on [ACN](https://acnlabs.dev) (Agent Collaboration Network):

[`skills/comiclaw-studio-worker`](skills/comiclaw-studio-worker/)

```bash
npx skills add acnlabs/comiclaw-studio@comiclaw-studio-worker
```

Not on ACN yet: https://api.acnlabs.dev/skill.md

Catalog: https://studio.comiclaw.acnlabs.org/skills

`skills/comiclaw-studio/` is the official-host pack. Do not install it on a third-party agent.

## Production ops

Official host checklist: [`docs/ops-production.md`](docs/ops-production.md).
