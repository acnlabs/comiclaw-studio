#!/usr/bin/env bash
# ACN CLI `--runtime command --wake-exec` → OpenClaw `/hooks/agent`
#
# IMPORTANT: do NOT pipe stdin into `python3 <<'PY'` — the heredoc steals stdin
# and the ACN event body is lost (task_id becomes unknown). Read BODY via env.
set -euo pipefail

TOKEN_FILE="${COMICLAW_HOOKS_TOKEN_FILE:-$HOME/.config/comiclaw/hooks.token}"
WAKE_URL="${OPENCLAW_WAKE_URL:-http://127.0.0.1:10122/hooks/agent}"
LOG="${COMICLAW_WAKE_LOG:-$HOME/logs/comiclaw/acn-wake.log}"
mkdir -p "$(dirname "$LOG")"

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


def dig(obj, *paths):
    """Try dotted paths; return first non-empty string."""
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
            v = obj.get(k)
            if isinstance(v, str) and UUID_RE.fullmatch(v.strip()):
                return v.strip()
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
        # last resort: UUID next to task_id= in free text
        m = re.search(r"task_id[=:\s]+(" + UUID_RE.pattern + r")", obj, re.I)
        if m:
            return m.group(1)
    return None


tid = dig(ev, "task_id", "taskId", "acn_task_id") or find_task_id(ev)
etype = dig(ev, "event_type", "type") or "acn_event"
subnet = dig(ev, "subnet_slug", "subnet") or ""
msg_id = dig(ev, "message_id", "messageId") or ""

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

# debug line for ops (not sent to OpenClaw)
dbg = {
    "parsed_task_id": tid,
    "event_type": etype,
    "message_id": msg_id,
    "body_len": len(raw),
    "body_head": raw[:400],
}
open(os.environ.get("COMICLAW_WAKE_LOG", os.path.expanduser("~/logs/comiclaw/acn-wake.log")), "a").write(
    json.dumps({"wake_parse": dbg}, ensure_ascii=False) + "\n"
)
PY
)

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
code=$(curl -sS -m 8 -o /tmp/acn-wake-resp.json -w '%{http_code}' -X POST "$WAKE_URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" || echo 000)
echo "$ts wake_http=$code url=$WAKE_URL" >> "$LOG"
head -c 500 /tmp/acn-wake-resp.json >> "$LOG" 2>/dev/null || true
echo >> "$LOG"

case "$code" in
  2*) exit 0 ;;
  *) echo "wake failed http=$code" >&2; exit 1 ;;
esac
