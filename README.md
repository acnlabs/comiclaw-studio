# ComicLaw Studio

English | [简体中文](README.zh-CN.md)

Content platform and production workspace for **ComicLaw** — a conversational AI agent that handles the full short-video and short-drama production pipeline. The agent pushes deliverables to Studio via REST API during production; clients follow the script, assets, storyboard and final film in real time through a private share link (SSE auto-refresh); released works are automatically published to the public-facing platform.

## Site structure

| Menu | Path | Content |
|------|------|---------|
| For You | `/` | TikTok-style swipe feed (short videos + series, orientation-adaptive, autoplay) |
| Series | `/series` | Series library (currently one sub-category: Comic Drama); detail page `/series/<id>` with episode player |
| Studio | `/studio` | Workspace entry: brand page; append `?key=<ADMIN_KEY>` for the admin project list |
| Project workspace | `/p/<shareToken>` | Client-private link showing every deliverable of one project |

**Release sync**: when a project's release record is set to `PUBLISHED`, the latest film cut is automatically published as a platform work (idempotent — one work per project) and appears in the For You feed. A whole series can be published directly via `POST /api/agent/works`.

## Workflow & panels

Fixed five-stage pipeline: **Script → Assets → Storyboard → Film → Release**

| Panel | Content |
|-------|---------|
| Pipeline header | Project info + current stage progress |
| Script | Scene-by-scene script (Markdown), version switching with change logs |
| Assets | Character / scene / prop design cards, multi-version images |
| Storyboard | Shot grid: frame (image/video), duration, dialogue, action, referenced assets |
| Film | Video player + version history and editor's notes |
| Release | Per-platform publish status and watch links |

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL

Real-time via SSE with a 30-second polling fallback (keeps pages updating on serverless where SSE can't cross instances).

**i18n**: the UI ships in English and Chinese — toggle in the top-right corner (cookie, 1 year), auto-detected from `Accept-Language` on first visit, no URL prefix so share links work in both languages. All strings live in `src/lib/i18n.ts`. Content pushed by the agent (scripts, titles, etc.) is not translated.

## Local development

```bash
npm install
# Set up a PostgreSQL instance and configure DATABASE_URL in .env
npx prisma migrate dev   # initialize the database
npm run db:seed          # seed the demo project
npm run dev
```

Open <http://localhost:3000/p/demo> to view the demo project.

Environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://studio:studio@localhost:5432/studio` |
| `STUDIO_API_KEY` | Bearer key for the agent push API — use a strong random value in production |
| `ADMIN_KEY` | Admin key for the project list at `/studio?key=<ADMIN_KEY>`; if unset, the list is hidden from everyone |

### Access isolation

Each project gets an unguessable `shareToken`; a client can only view their own project at `/p/<shareToken>`. The Studio page shows only branding to regular visitors — the full project list requires the admin key.

## Agent API

All `/api/agent/*` endpoints require `Authorization: Bearer <STUDIO_API_KEY>` and a JSON body.

| Method | Path | Purpose | Key fields |
|--------|------|---------|-----------|
| POST | `/api/agent/projects` | Create project, returns `sharePath` | `name`*, `clientName`, `agentName`, `description`, `coverUrl` |
| GET | `/api/agent/projects` | List projects | — |
| GET | `/api/agent/projects/:id` | Full project data | — |
| PATCH | `/api/agent/projects/:id` | Update info / advance stage | `currentStage` (SCRIPT/ASSETS/STORYBOARD/FILM/RELEASE/DONE) |
| POST | `/api/agent/projects/:id/script-versions` | Push a new script version (auto-incremented) | `content`*, `title`, `logline`, `changeLog` |
| POST | `/api/agent/projects/:id/assets` | Create asset (optionally with first design image) | `type`* (CHARACTER/SCENE/PROP), `name`*, `description`, `imageUrl`, `notes` |
| POST | `/api/agent/assets/:assetId/versions` | Push a new asset design version | `imageUrl`*, `notes` |
| POST | `/api/agent/projects/:id/shots` | Create shot (optionally with first frame and asset refs) | `order`*, `title`, `duration`, `dialogue`, `action`, `mediaUrl`, `mediaType` (IMAGE/VIDEO), `assetIds` |
| PATCH | `/api/agent/shots/:shotId` | Update shot text / asset refs | same as above (except `order`) |
| POST | `/api/agent/shots/:shotId/versions` | Push a new shot frame version | `mediaUrl`*, `mediaType`, `notes` |
| POST | `/api/agent/projects/:id/film-versions` | Push a new film cut | `videoUrl`*, `duration`, `notes` |
| POST | `/api/agent/projects/:id/releases` | Add a release record | `platform`*, `url`, `status`, `notes` |
| PATCH | `/api/agent/releases/:releaseId` | Update release status (PUBLISHED auto-publishes the work) | `status` (PENDING/PUBLISHED), `url`, `publishedAt` |
| POST | `/api/agent/works` | Publish a platform work directly (e.g. a whole series) | `kind`* (VIDEO/SERIES), `title`*, `category`, `videoUrl`, `coverUrl`, `description`, `authorName`, `episodes[]` (order/title/videoUrl/duration) |

Example — create a project and push a script:

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

Media (design images, videos) are referenced by URL — links from any AI video/image generation tool work as-is.

## Deployment

### Vercel + Neon (free tiers)

1. **Repository**: Vercel's Hobby plan supports public GitHub repositories. Private org repos require a Pro plan; alternatively mirror the repo to a personal account.
2. **Database**: create a free PostgreSQL project on [neon.tech](https://neon.tech) and copy the connection string.
3. **Import**: in the Vercel console, import the repo (Next.js auto-detected; the `vercel-build` script runs migrations automatically) and set three environment variables: `DATABASE_URL`, `STUDIO_API_KEY`, `ADMIN_KEY`.
4. (Optional) seed demo data: run `npm run db:seed` locally with `DATABASE_URL` pointing at Neon.

> On Vercel serverless, SSE can't cross instances — pages fall back to 30-second polling, which is sufficient for viewing.

### Self-hosted (Docker Compose)

```bash
STUDIO_API_KEY="<strong-random>" ADMIN_KEY="<strong-random>" POSTGRES_PASSWORD="<strong-random>" \
  docker compose up -d --build
```

One command starts the app and PostgreSQL together, with migrations applied on startup.

## Integrating your agent

The intended loop: the agent creates a project via API and sends the client a share link (`<studio domain>/p/<shareToken>`); deliverables are pushed as each stage is completed; the client watches progress in real time; when a release is marked `PUBLISHED` the work automatically appears in the For You feed.

A ready-made skill package for AI agents lives in [`skills/comiclaw-studio/`](skills/comiclaw-studio/):

- `SKILL.md` — workflow contract: create the project and send the link first, push each stage's deliverables immediately, push new versions on rework, advance the pipeline, record releases;
- `scripts/studio.sh` — CLI wrapper around the API; run `studio.sh help` for all commands.

To use it: drop `skills/comiclaw-studio/` into your agent's skills directory and configure `STUDIO_BASE_URL` and `STUDIO_API_KEY` in the skill environment.

## Directory layout

```
prisma/                 # data model, migrations, demo seed
src/lib/                # Prisma singleton, event bus, auth helpers, release sync, i18n, types
src/app/api/agent/      # agent push API (Bearer key auth)
src/app/api/projects/   # client-side SSE endpoint
src/app/page.tsx        # For You (swipe feed)
src/app/series/         # series library & detail page (episode player)
src/app/studio/         # Studio entry (brand page / admin view)
src/app/p/[token]/      # client workspace (login-free share link)
src/components/         # site nav, work cards/player, pipeline header, five panels
skills/                 # agent skill package
scripts/                # placeholder generation, page screenshots
```
