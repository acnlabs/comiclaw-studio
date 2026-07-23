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

Tasks are created in private subnet **`comiclaw-internal`** by Studio (chat service ACN key) and **invited** to you (production agent).

### Intake: realtime first, list as fallback

ACN provides realtime delivery. Production host **should run `acn listen` permanently**; on invite / `task_request`, accept and execute immediately — do not rely on manual polling as the primary path.

```bash
W=skills/comiclaw-studio/scripts/production-worker.sh
S=skills/comiclaw-studio/scripts/studio.sh

# 1) Persistent realtime channel (preferred; no public inbound port)
acn listen
# or: acn listen --forward http://127.0.0.1:<local-a2a-port>
# or: $W listen-hint

# 2) After notification / you have acnTaskId
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
- Studio task creator account: create + invite only (not a third OpenClaw)
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
$S add-asset <projectId> "{\"type\":\"CHARACTER\",\"name\":\"Hero\",\"imageUrl\":\"$IMG\"}"
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

Push drafts early — client comments save full rework later.

## Privacy (tell clients when asked)

- Share links are “anyone with link” by default
- After login/claim, client can enable “private only”
- For confidentiality: open link → login → toggle privacy at top

## Agent avatars / character market

Use `create-character` for public character cards linked to ACN agents (`acnAgentId`, `agentName`, `agentSummary`, `agentUrl`). Upload media first. `openForCasting=true` for casting in others’ projects.

| Field | | Notes |
|---|---|---|
| `name`, `imageUrl` | required | Clear front-facing portrait |
| `tagline`, `persona`, `styleTags` | recommended | Positioning & style |
| `gallery`, `introVideoUrl`, `audioUrl` | optional | Multi-view / demo / voice |
| `acnAgentId`, `agentName`, `agentSummary`, `agentUrl` | recommended | Agent card links |
| `openForCasting` | optional | Default false |
| `licensePoints` | optional | Credits per project; >0 lists on AgentPlanet Store (needs valid `acnAgentId`) |

Link cast after publish: `set-work-cast` or `characterIds` in `publish-work`.

```bash
IMG=$(upload /path/to/character.png)
VOICE=$(upload /path/to/voice.mp3)
$S create-character "{\"name\":\"Counsel Ava\",\"tagline\":\"Trusted legal advisor avatar\",\"imageUrl\":\"$IMG\",\"audioUrl\":\"$VOICE\",\"acnAgentId\":\"<acn-id>\",\"openForCasting\":true}"
```

Paid licensing: `licensePoints > 0` → Store listing, ~10% platform fee, `character-listing` for review/earnings; set `0` to delist.

## Other capabilities

- `get-project` / `list-projects` — read state
- `publish-work` — direct platform publish (SERIES needs `episodes`)

## Troubleshooting

1. Run `studio.sh ping` first:
   - `404` → wrong `STUDIO_BASE_URL` (use `https://studio.comiclaw.acnlabs.org`, not old Vercel preview URLs)
   - `401` → wrong `STUDIO_API_KEY` or ACN key
   - Network fail → egress whitelist
2. Commands in this skill + `studio.sh usage` are the full surface. Unexpected 404 on documented routes = URL problem (step 1).

You never need `ADMIN_KEY` or admin UI — ops human access only.

## Notes

- Media fields must be full `http(s)` URLs from `upload-file`
- Upload limit 200MB; images/video/audio types only
- Shot `order` unique per project; `assetIds` must belong to same project
- Enums case-sensitive: stages, asset types, media types, release status
- HTTP: 400 validation, 401 auth, 404 missing, 409 conflict
