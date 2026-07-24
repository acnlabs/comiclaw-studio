#!/usr/bin/env bash
# ACN CLI `--runtime command --wake-exec` → OpenClaw `/hooks/agent`
#
# IMPORTANT: do NOT pipe stdin into `python3 <<'PY'` — the heredoc steals stdin
# and the ACN event body is lost (task_id becomes unknown). Read BODY via env.
#
# Prerequisites (ops):
#   ~/.config/comiclaw/hooks.token  — OpenClaw hooks bearer (or COMICLAW_HOOKS_TOKEN_FILE)
#   OPENCLAW_WAKE_URL               — default http://127.0.0.1:10122/hooks/agent
set -euo pipefail

TOKEN_FILE="${COMICLAW_HOOKS_TOKEN_FILE:-$HOME/.config/comiclaw/hooks.token}"
WAKE_URL="${OPENCLAW_WAKE_URL:-http://127.0.0.1:10122/hooks/agent}"
LOG="${COMICLAW_WAKE_LOG:-$HOME/logs/comiclaw/acn-wake.log}"
mkdir -p "$(dirname "$LOG")"

if [[ ! -r "$TOKEN_FILE" ]]; then
  echo "wake failed: missing readable token file: $TOKEN_FILE" >&2
  exit 1
fi
TOKEN=$(cat "$TOKEN_FILE")
BODY=$(cat || true)

# shellcheck disable=SC2016
PAYLOAD=$(
  ACN_WAKE_BODY="$BODY" COMICLAW_WAKE_LOG="$LOG" python3 <<'PY'
import json, os, re

raw = os.environ.get("ACN_WAKE_BODY", "") or ""
try:
    ev = json.loads(raw) if raw.strip() else {}
except Exception:
    ev = {"raw": raw[:4000]}

UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.I,
)
# Strip control chars / newlines from fields interpolated into OpenClaw message
CTRL_RE = re.compile(r"[\x00-\x1f\x7f]+")


def clean_field(s, max_len=120):
    if not isinstance(s, str):
        return ""
    s = CTRL_RE.sub(" ", s).strip()
    if len(s) > max_len:
        s = s[:max_len]
    return s


def as_uuid(s):
    if not isinstance(s, str):
        return None
    s = s.strip()
    return s if UUID_RE.fullmatch(s) else None


def dig(obj, *paths):
    """Try dotted paths; return first non-empty string (unchecked)."""
    for path in paths:
        cur = obj
        ok = True
        for part in path.split("."):
            if not isinstance(cur, dict) or part not in cur:
                ok = False
                break
            cur = cur[part]
        if ok and isinstance(cur, str) and cur.strip():
            return cur.strip()
    return None


def find_task_id(obj, depth=0):
    if depth > 6 or obj is None:
        return None
    if isinstance(obj, dict):
        for k in ("task_id", "taskId", "acn_task_id", "acnTaskId"):
            found = as_uuid(obj.get(k)) if isinstance(obj.get(k), str) else None
            if found:
                return found
        for v in obj.values():
            found = find_task_id(v, depth + 1)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_task_id(v, depth + 1)
            if found:
                return found
    elif isinstance(obj, str):
        m = re.search(r"task_id[=:\s]+(" + UUID_RE.pattern + r")", obj, re.I)
        if m:
            return m.group(1)
    return None


tid = as_uuid(dig(ev, "task_id", "taskId", "acn_task_id")) or find_task_id(ev)
etype = clean_field(dig(ev, "event_type", "type") or "acn_event", 64) or "acn_event"
subnet = clean_field(dig(ev, "subnet_slug", "subnet") or "", 80)
msg_id = clean_field(dig(ev, "message_id", "messageId") or "", 80)

if tid:
    text = (
        f"ACN {etype}: task_id={tid}; subnet={subnet}; message_id={msg_id}. "
        f"You are the production comiclaw worker. Immediately run "
        f"`skills/comiclaw-studio/scripts/production-worker.sh handle {tid}` "
        f"then accept / work / submit per comiclaw-studio skill. "
        f"OpenClaw Job ID is NOT an ACN task id. "
        f"Do NOT edit openclaw.json or systemd."
    )
else:
    text = (
        f"ACN {etype}: task_id missing in wake payload; subnet={subnet}; message_id={msg_id}. "
        f"Run `skills/comiclaw-studio/scripts/production-worker.sh reconcile` "
        f"and handle the newest open WRITE_SCRIPT/GENERATE_IMAGE in comiclaw-internal. "
        f"Do NOT use OpenClaw Job ID as acnTaskId. "
        f"Do NOT edit openclaw.json or systemd."
    )

out = {
    "message": text,
    "name": "ACN",
    "wakeMode": "now",
    "agentId": "main",
    "meta": {
        "acn": {
            "task_id": tid,
            "event_type": etype,
            "message_id": msg_id,
            "subnet_slug": subnet,
        }
    },
}
print(json.dumps(out, ensure_ascii=False))

# Ops log: structured fields only (no task brief / raw body / HTTP response body)
dbg = {
    "parsed_task_id": tid,
    "event_type": etype,
    "message_id": msg_id,
    "subnet_slug": subnet,
    "body_len": len(raw),
    "json_ok": isinstance(ev, dict) and not (set(ev.keys()) <= {"raw"}),
}
log_path = os.environ.get("COMICLAW_WAKE_LOG") or os.path.expanduser(
    "~/logs/comiclaw/acn-wake.log"
)
with open(log_path, "a", encoding="utf-8") as f:
    f.write(json.dumps({"wake_parse": dbg}, ensure_ascii=False) + "\n")
PY
)

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
code=$(curl -sS -m 8 -o /tmp/acn-wake-resp.json -w '%{http_code}' -X POST "$WAKE_URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" || echo 000)
# Status only — parsed_task_id already in wake_parse line above; no response body
echo "$ts wake_http=$code url=$WAKE_URL" >> "$LOG"

case "$code" in
  2*) exit 0 ;;
  *) echo "wake failed http=$code" >&2; exit 1 ;;
esac
