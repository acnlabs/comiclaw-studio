#!/usr/bin/env bash
# ACN CLI `--runtime command --wake-exec` → OpenClaw `/hooks/agent`
#
# IMPORTANT: do NOT pipe stdin into `python3 <<'PY'` — the heredoc steals stdin
# and the ACN event body is lost (task_id becomes unknown). Read BODY via env.
#
# Branches:
#   - metadata.agentplanet.chat_id → Interfaze chat (LEGACY: LLM + chat-writeback.sh)
#   - task_id → Studio production worker (existing path)
#   - else → reconcile hint
#
# Prefer (ACN CLI ≥ 0.14.1): --chat-writeback --chat-complete-exec chat-complete.sh
# so chat envelopes never enter this wake-exec; this script stays for Task / legacy.
#
# Prerequisites (ops):
#   ~/.config/comiclaw/hooks.token  — OpenClaw hooks bearer (or COMICLAW_HOOKS_TOKEN_FILE)
#   OPENCLAW_WAKE_URL               — default http://127.0.0.1:10122/hooks/agent
# Legacy chat writeback also needs:
#   AGENTPLANET_API_BASE, AGENTPLANET_INTERNAL_TOKEN, COMICLAW_ACN_AGENT_ID
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


def find_chat_id(obj, depth=0):
    """Prefer AgentPlanet chat writeback metadata; never invent ids."""
    if depth > 8 or obj is None:
        return None
    if isinstance(obj, dict):
        ap = obj.get("agentplanet")
        if isinstance(ap, dict):
            cid = ap.get("chat_id") or ap.get("chatId")
            if isinstance(cid, str) and cid.strip():
                return cid.strip()
        meta = obj.get("metadata")
        if isinstance(meta, dict):
            found = find_chat_id(meta, depth + 1)
            if found:
                return found
        # Nested raw / message / params (A2A relay / normalized wake shapes)
        for k in ("raw", "message", "params", "result", "body", "data"):
            if k in obj:
                found = find_chat_id(obj[k], depth + 1)
                if found:
                    return found
        for v in obj.values():
            found = find_chat_id(v, depth + 1)
            if found:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_chat_id(v, depth + 1)
            if found:
                return found
    return None


def extract_user_text(obj, depth=0, limit=2000):
    if depth > 8 or obj is None:
        return ""
    if isinstance(obj, dict):
        parts = obj.get("parts")
        if isinstance(parts, list):
            chunks = []
            for p in parts:
                if isinstance(p, dict) and isinstance(p.get("text"), str):
                    t = p["text"].strip()
                    if t:
                        chunks.append(t)
            if chunks:
                return CTRL_RE.sub(" ", "\n".join(chunks)).strip()[:limit]
        for k in ("text", "prompt", "content"):
            v = obj.get(k)
            if isinstance(v, str) and v.strip():
                return CTRL_RE.sub(" ", v).strip()[:limit]
        for k in ("raw", "message", "params", "body", "data"):
            if k in obj:
                t = extract_user_text(obj[k], depth + 1, limit)
                if t:
                    return t
        for v in obj.values():
            t = extract_user_text(v, depth + 1, limit)
            if t:
                return t
    elif isinstance(obj, list):
        for v in obj:
            t = extract_user_text(v, depth + 1, limit)
            if t:
                return t
    return ""


tid = as_uuid(dig(ev, "task_id", "taskId", "acn_task_id")) or find_task_id(ev)
chat_id = dig(
    ev,
    "metadata.agentplanet.chat_id",
    "agentplanet.chat_id",
    "message.metadata.agentplanet.chat_id",
    "raw.metadata.agentplanet.chat_id",
    "params.message.metadata.agentplanet.chat_id",
) or find_chat_id(ev)
etype = clean_field(dig(ev, "event_type", "type") or "acn_event", 64) or "acn_event"
subnet = clean_field(dig(ev, "subnet_slug", "subnet") or "", 80)
msg_id = clean_field(dig(ev, "message_id", "messageId") or "", 80)
user_text = extract_user_text(ev)
user_preview = clean_field(user_text, 500) or "(no text extracted)"

# Chat writeback takes priority when AgentPlanet tagged the envelope.
# Production task_id path unchanged otherwise.
if chat_id:
    text = (
        f"Interfaze/AgentPlanet chat ({etype}): chat_id={chat_id}; message_id={msg_id}. "
        f"User said: {user_preview} "
        f"Compose a concise helpful reply as comiclaw, then IMMEDIATELY run "
        f"`skills/comiclaw-studio/scripts/chat-writeback.sh {chat_id}` with the reply on stdin "
        f"(or as the second CLI argument). "
        f"Requires env AGENTPLANET_API_BASE, AGENTPLANET_INTERNAL_TOKEN, COMICLAW_ACN_AGENT_ID. "
        f"Do NOT run production-worker. Do NOT treat this as WRITE_SCRIPT/GENERATE_IMAGE. "
        f"Do NOT edit openclaw.json or systemd."
    )
elif tid:
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
            "chat_id": chat_id,
            "event_type": etype,
            "message_id": msg_id,
            "subnet_slug": subnet,
            "kind": "chat" if chat_id else ("task" if tid else "unknown"),
        }
    },
}
print(json.dumps(out, ensure_ascii=False))

dbg = {
    "parsed_task_id": tid,
    "parsed_chat_id": chat_id,
    "event_type": etype,
    "message_id": msg_id,
    "subnet_slug": subnet,
    "kind": "chat" if chat_id else ("task" if tid else "unknown"),
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
echo "$ts wake_http=$code url=$WAKE_URL" >> "$LOG"

case "$code" in
  2*) exit 0 ;;
  *) echo "wake failed http=$code" >&2; exit 1 ;;
esac
