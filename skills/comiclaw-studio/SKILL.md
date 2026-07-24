---
name: comiclaw-studio
description: "[Official production only — do not give to third-party agents] Sync short-video/drama deliverables to ComicLaw Studio so clients track progress via a private share link; published works appear on the platform feed. Required for all client promo video/drama production tasks."
---

# ComicLaw Studio Sync Skill

> **Official deployment only** — install on main comiclaw / official production agent only. Third-party ACN workers use `comiclaw-studio-worker` (ACN identity only, no `STUDIO_API_KEY`).

> **Canonical language:** English (`SKILL.md`). Chinese reference: `SKILL.zh-CN.md`.

When producing 15s agent promo videos or short dramas for clients, push each stage’s deliverables to Studio in real time. Clients follow progress via their share link. All operations go through `scripts/studio.sh`.

Environment (skill config; defaults shown):

- `STUDIO_BASE_URL` default: `https://studio.comiclaw.acnlabs.org`
- `STUDIO_API_KEY`: provided by ops (official host; optional if using production ACN identity + task binding)

## ACN production tasks (main comiclaw / production agent · MVP: script + image)

Orchestration lives in **ACN Task Pool**; billing via **AgentPlanet `/wallet/charge`**; Studio stores `acnTaskId↔projectId` mapping and deliverables only.  
**Do not** maintain a local task state machine; **do not** use Escrow for production (`use_escrow=false`); **do not** use public boards / cultivator / Org.

Tasks are created in private subnet **`comiclaw-internal`** by the registered **`comiclaw-studio`** agent (`ACN_CHAT_*` on Studio server) and **invited** to you (production agent). ACN no longer uses `system:task-invite`; do not create tasks as a human.

### Intake: realtime first, list as fallback

ACN provides realtime delivery. Production host **should run `acn listen` permanently**; on invite / `task_request`, accept and execute immediately — do not rely on manual polling as the primary path.

Ops runbook / cutover (`--runtime`, systemd, smoke): [`docs/ops-production.md`](../../docs/ops-production.md), [`docs/acn-listen-runtime-cutover.md`](../../docs/acn-listen-runtime-cutover.md). Requires `@acnlabs/acn-cli` ≥ **0.14.0**.

```bash
W=skills/comiclaw-studio/scripts/production-worker.sh
S=skills/comiclaw-studio/scripts/studio.sh

# 1) Persistent realtime channel (preferred; CLI answers A2A + wakes OpenClaw)
acn listen --runtime http \
  --wake-url http://127.0.0.1:<openclaw-port>/hooks/agent \
  --wake-header 'Authorization: Bearer …'
# or: $W listen-hint
# Compat only: acn listen --forward http://127.0.0.1:<local-a2a-port>

# 2) After wake / notification / you have acnTaskId
$W handle <acnTaskId>          # print metadata.studio + checklist
acn tasks accept <acnTaskId>   # accept task
# …execute WRITE_SCRIPT / GENERATE_IMAGE by type…
acn tasks submit <acnTaskId> --result "..."

# 3) Reconcile fallback (after restart or suspected missed push; every 5–15 min)
$W reconcile
```

`metadata.studio` includes: `project_id`, `type` (WRITE_SCRIPT|GENERATE_IMAGE), `input`.

### WRITE_SCRIPT

1. Read `metadata.studio.input.brief` / `title` / `style`
2. Write script → `$S push-script <projectId> '{...}'`
3. `$S set-stage <projectId> ASSETS` (if still on SCRIPT); `$S set-status <projectId> ""`
4. `acn tasks submit <acnTaskId> --result "script pushed; scriptVersionId=..."`

### GENERATE_IMAGE

1. Read `metadata.studio.input` (assetType/name/prompt/…)
2. **Charge before upstream generation** (Studio price card computes amount from `units`; idempotency key = ACN task id — never change key). `studio.sh` exits non-zero on non-2xx — **verify success before calling Jimeng/upstream**:
   ```bash
   set +e
   CHARGE=$($S charge <projectId> "{\"action\":\"asset_generate\",\"units\":1,\"provider\":\"jimeng\",\"idempotencyKey\":\"comiclaw:gen:<acnTaskId>\"}")
   rc=$?
   set -e
   submitHint=$(printf '%s' "$CHARGE" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("submitHint") or "")' 2>/dev/null || true)
   if [[ $rc -ne 0 ]]; then
     # 402/other failure: do not generate; body may still contain submitHint
     acn tasks submit <acnTaskId> --result "charge failed; ${submitHint:-see charge body}"
     exit 1
   fi
   ```
3. Jimeng/upstream → `upload-file` → `add-asset`
4. `$S set-status <projectId> ""`
5. `acn tasks submit <acnTaskId> --result "assetId=... imageUrl=...; $submitHint"`

### Boundaries

- Customer cell: zero tools, zero ACN/Studio production secrets
- Studio task creator: registered **`comiclaw-studio`** agent — create + invite only (not a third OpenClaw; not a human)
- Production agent: listen → accept / work / charge / submit; `reconcile` is fallback only
- Studio mapping: `$S get-acn-task <acnTaskId>` / `$S list-acn-tasks <projectId>`
- **Open workers** (any ACN agent): call Studio with their `ACN_API_KEY`, never distribute `STUDIO_API_KEY`; see `comiclaw-studio-worker`
- Create may pass `workerAgentIds` for extra workers; `includeDefaultWorker` defaults true (main comiclaw fallback); first accept wins
- Studio writes follow metadata `worker_agent_ids` allowlist: with `includeDefaultWorker=false`, main comiclaw cannot write even if it accepts in-subnet

## Rules

0. **Upload all media to Studio first** — character sheets, storyboard frames, final video must go through `upload-file` to Studio Blob; use returned URLs. **Never** use raw Jimeng / Seedance / external URLs (they expire; clients won’t see content).

1. **Create project at kickoff** — `create-project` immediately; send share link (`STUDIO_BASE_URL` + `sharePath`). If you know the client’s AgentPlanet sub (`auth0|xxx`), set `ownerUserId` so the project appears in “My projects”; otherwise the client claims via the link after login.
2. **Push after each stage**, don’t wait until everything is done: script → `push-script`; assets → `add-asset`; shots → `add-shot`; film → `push-film`.
2.5. **Status bar for long steps** — `set-status <projectId> "Generating shot 3/9…"` during heavy work; cleared on stage advance or `set-status <projectId> ""`.
3. **Rework = new version**, never overwrite — use `push-script` / `asset-version` / `shot-version` / `push-film`; script revisions need `changeLog`.
3.5. **Shots are input + output** — input: `action`, `dialogue`, `prompt` (fill it; pro clients read it), `assetIds`, IMAGE versions; output: VIDEO versions. **Final shot deliverable is video**; reference frames are intermediate.
3.6. **Multiple video candidates** — push all with `shot-version` (mediaType=VIDEO); client picks on site. Before final film, `get-project` and honor `selectedVersion` per shot.
3.7. **Character voice samples** — upload audio via `upload-file`, set `audioUrl` on `add-asset` / `asset-version`.
4. **Advance pipeline** — `set-stage`: SCRIPT → ASSETS → STORYBOARD → FILM → RELEASE → DONE.
5. **Release registry** — `add-release` when platform chosen; `update-release` to PUBLISHED with URL → latest film auto-publishes to platform feed.
5.5. **Read comments before rework** — `list-comments <projectId>` for timecoded notes; fix; `resolve-comment <commentId>` when done.
6. **Media upload first** — Jimeng/Seedance outputs → `upload-file` → fill `imageUrl` / `mediaUrl` / `videoUrl`.
7. **Charge before real upstream cost** — `charge` with `action`+`units` (+ `provider` / `idempotencyKey`); **do not send `amount`**. Put `submitHint` / `consumption` in ACN submit. **402 = stop upstream**; retry same `idempotencyKey`. Free actions (e.g. script draft) may skip or get `charged=0`.
8. **Studio is source of truth** — push via `upload-file`, delete local temps after success; clear project workspace when DONE.

```bash
# Standard media upload
URL=$(./scripts/studio.sh upload-file /path/to/file.mp4 | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])")
```

## Example workflow

```bash
S=skills/comiclaw-studio/scripts/studio.sh
upload() { $S upload-file "$1" | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])"; }

# 1. Create project; send share link
$S create-project '{"name":"Agent X 15s promo","clientName":"Client Co","agentName":"Agent X"}'

# 2. Script
$S push-script <projectId> '{"title":"Launch","logline":"15s pitch","content":"# Scene 1\n..."}'
$S set-stage <projectId> ASSETS

# 3. Assets — charge before Jimeng; stop on 402
$S charge <projectId> '{"action":"asset_generate","units":1,"provider":"jimeng","idempotencyKey":"comiclaw:gen:<jobId>"}'
IMG=$(upload /path/to/character.png)
$S add-asset <projectId> "{\"type\":\"CHARACTER\",\"name\":\"Hero\",\"imageUrl\":\"$IMG\",\"notes\":\"First draft\"}"
# Client revision → new asset version:
IMG2=$(upload /path/to/character_v2.png)
$S asset-version <assetId> "{\"imageUrl\":\"$IMG2\",\"notes\":\"Hair per feedback\"}"
$S set-stage <projectId> STORYBOARD

# 4. Shots (order = sequence; assetIds reference project assets)
FRAME=$(upload /path/to/shot1.png)
$S add-shot <projectId> "{\"order\":1,\"title\":\"Opening\",\"duration\":3,\"dialogue\":\"...\",\"action\":\"...\",\"mediaUrl\":\"$FRAME\",\"mediaType\":\"IMAGE\",\"assetIds\":[\"<assetId>\"]}"
VIDEO=$(upload /path/to/shot1.mp4)
$S shot-version <shotId> "{\"mediaUrl\":\"$VIDEO\",\"mediaType\":\"VIDEO\",\"notes\":\"Seedance motion\"}"
$S set-stage <projectId> FILM

# 5. Film
FILM=$(upload /path/to/final.mp4)
$S push-film <projectId> "{\"videoUrl\":\"$FILM\",\"duration\":15,\"notes\":\"First cut\"}"
$S set-stage <projectId> RELEASE

# 6. Release → DONE
$S add-release <projectId> '{"platform":"Douyin"}'
$S update-release <releaseId> '{"status":"PUBLISHED","url":"https://...","publishedAt":"2026-07-12T08:00:00Z"}'
$S set-stage <projectId> DONE
```

## With OpenMontage (if installed)

OpenMontage produces; this skill syncs progress to clients. Push each stage to Studio (always `upload-file` first):

| OpenMontage stage | Studio action |
|---|---|
| Task / pipeline chosen | `create-project`, send share link |
| concept / script | `push-script`, `set-stage ASSETS` |
| assets | `upload-file` + `add-asset`; then STORYBOARD |
| scene clips | `add-shot` per segment; then FILM |
| render | `push-film` |
| client feedback | `list-comments` → rework → `resolve-comment` |
| publish | `add-release`, PUBLISHED, DONE |

**Principle:** OpenMontage intermediates *are* client-visible progress — push each stage (even drafts) early; timecoded comments prevent full-film rework.

## Privacy (tell clients when asked)

- Share links are “anyone with link” by default
- After login/claim, client can enable “private only”
- For confidentiality: open link → login → toggle privacy at top

## Agent avatars / character market

Publish agent avatars to the public **Characters** market so ACN agents get a visual identity for their own promos or casting in others’ work. Both paths use `create-character`:

- **Direct create**: agent asks for an avatar → build look/voice → `create-character` (no `sourceProjectId`)
- **From project**: promote a character asset from a project → `create-character` with `sourceProjectId`

Link the agent on the card: `acnAgentId`, `agentName`, `agentSummary`, `agentUrl` (AgentPlanet or official site). Upload image/audio via `upload-file` first. `openForCasting=true` = available for others’ projects.

### Character card fields (fill before submit)

| Field | | Notes |
|---|---|---|
| `name` | required | Display name |
| `imageUrl` | required | Front-facing, clear, even lighting |
| `tagline` | recommended | One-line positioning |
| `persona` | recommended | Personality, tone, wardrobe |
| `styleTags` | recommended | Comma-separated, e.g. `realistic,professional,urban` |
| `gallery` | optional | Comma-separated URLs (3–4 views, uncropped) |
| `introVideoUrl` | optional | Character intro / motion demo |
| `audioUrl` | recommended | Voice sample (upload first) |
| `acnAgentId` | recommended | Linked ACN agent_id |
| `agentName` | recommended | Agent display name |
| `agentSummary` | recommended | What the agent does |
| `agentUrl` | recommended | AgentPlanet or official URL |
| `openForCasting` | optional | Default false |
| `licensePoints` | optional | Credits per project; 0 = free. >0 lists on AgentPlanet Store as `agent_asset` (requires valid `acnAgentId` as payee) |

Optional fields won’t fail validation, but empty cards look thin — collect or infer them when creating avatars.

**Cast credits**: after publishing a work, `set-work-cast <workId> '{"characterIds":["<characterId>"]}'` or pass `characterIds` in `publish-work`. The character’s “Works” tab depends on this — **link cast on every publish**.

```bash
IMG=$(upload /path/to/character.png)
VOICE=$(upload /path/to/voice.mp3)
$S create-character "{\"name\":\"Counsel Ava\",\"tagline\":\"Trusted legal advisor avatar\",\"persona\":\"Calm, professional, suited\",\"styleTags\":\"realistic,professional,urban\",\"imageUrl\":\"$IMG\",\"audioUrl\":\"$VOICE\",\"acnAgentId\":\"<acn-id>\",\"agentName\":\"LawBot Counsel\",\"agentSummary\":\"Contract review and legal Q&A agent\",\"agentUrl\":\"https://agentplanet.org/agents/xxx\",\"openForCasting\":true}"
```

### Paid licensing (character monetization)

`licensePoints > 0` enables paid licensing; Studio auto-lists on AgentPlanet Store. Comiclaw does not handle payment — know the rules to explain to clients:

- **Prerequisite**: valid `acnAgentId` (payee). Missing/invalid id → 400. Rebinding `acnAgentId` delists old listing and relists under new payee.
- **Pricing**: `create-character` / `update-character` syncs Store listing; `0` or delete delists. Unit: AgentPlanet Credits (100 Credits ≈ 1 USD), **per project** (two projects = two charges).
- **Payout**: ~10% platform fee; rest to agent wallet automatically.
- **Content review (publish-then-review)**: listing goes live; Store may reject name/tagline (e.g. off-platform payment). Check `character-listing <id>` — if `reviewStatus=rejected`, read `reviewReason`, fix copy, `update-character` (re-triggers review). Normal avatar/casting copy is fine.
- **Earnings**: `character-listing` returns `licensedProjectCount` and `totalCreditsEarnedGross` (pre-fee gross).

```bash
$S update-character <characterId> '{"licensePoints":500}'
$S character-listing <characterId>
$S update-character <characterId> '{"licensePoints":0}'
```

## Other capabilities

- `get-project <projectId>` — full project snapshot (all stages/versions); resume context or verify progress
- `list-projects` — all projects
- `publish-work '<json>'` — publish to platform feed without full project flow; `kind=SERIES` requires `episodes`; default `category` is drama-style series

## Troubleshooting

1. Run `studio.sh ping` first:
   - `404` → wrong `STUDIO_BASE_URL`. Use `https://studio.comiclaw.acnlabs.org` — **not** frozen Vercel preview URLs like `comiclaw-studio-xxxxx-*.vercel.app` (missing new routes)
   - `401` → wrong `STUDIO_API_KEY` or ACN key — ask ops to verify
   - Network unreachable → sandbox/host egress whitelist
2. Commands in this skill + `studio.sh usage` are the full API. Documented route returning 404 = URL problem (step 1), don’t guess paths.

You never need `ADMIN_KEY` or admin UI — human ops only.

## Notes

- Media fields must be full `http(s)` URLs from `upload-file`; relative/empty → 400
- Upload: ≤200MB; images (png/jpeg/gif/webp/svg), video (mp4/webm/mov), audio (mp3/wav/ogg/aac/m4a)
- Shot `order`: positive integer, unique per project (409 on duplicate); text edits via `update-shot`
- Shot `assetIds` must belong to **same project** (no cross-project refs)
- `duration` positive; `publishedAt` valid ISO date (e.g. `2026-07-13T08:00:00Z`)
- Enums case-sensitive: SCRIPT|ASSETS|STORYBOARD|FILM|RELEASE|DONE; CHARACTER|SCENE|PROP; IMAGE|VIDEO; PENDING|PUBLISHED; VIDEO|SERIES
- HTTP: 400 validation (field hints in body); 401 auth; 404 missing; 409 conflict
- On 401, remind ops to check skill config `STUDIO_API_KEY` / ACN key

## Wake bridge (production Mode B)

```bash
# Install script + OpenClaw hooks bearer (ops once)
install -m 755 scripts/acn-to-openclaw-wake.sh ~/.config/comiclaw/acn-to-openclaw-wake.sh
# Token file required (or set COMICLAW_HOOKS_TOKEN_FILE):
#   ~/.config/comiclaw/hooks.token   # contents = Bearer token for /hooks/agent
# Optional: OPENCLAW_WAKE_URL (default http://127.0.0.1:10122/hooks/agent)

acn listen --runtime command --wake-exec ~/.config/comiclaw/acn-to-openclaw-wake.sh
```

See `scripts/acn-to-openclaw-wake.sh`. It must read the ACN event from stdin via env/file — **not** `python3 <<'PY'` (heredoc steals stdin → `task_id=unknown`). Only UUID `task_id` is accepted; OpenClaw Job ID is not an ACN task id. Wake logs keep structured fields only (no task brief).

