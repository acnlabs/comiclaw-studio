#!/usr/bin/env bash
# ACN CLI `--chat-complete-exec` → OpenClaw `/hooks/agent` (wait for reply text).
#
# Contract (AgentPlanet chat-agent-writeback-v0 / acn listen --chat-writeback):
#   stdin  = NormalizedEvent JSON (includes .chat.chat_id, .chat.user_text, …)
#   stdout = JSON {"content":"<final reply text>"}
#   stderr = diagnostics; non-zero exit on failure
#
# IMPORTANT: do NOT use `python3 <<'PY'` while reading this script's stdin —
# the heredoc steals the event body. Pass BODY via env (same pattern as wake).
#
# Prerequisites:
#   ~/.config/comiclaw/hooks.token  — OpenClaw hooks bearer
#   OPENCLAW_WAKE_URL               — default http://127.0.0.1:10122/hooks/agent
#   OpenClaw with waitForResult on POST /hooks/agent (preferred)
#
# Optional:
#   COMICLAW_CHAT_COMPLETE_TIMEOUT  — curl max-time seconds (default 110)
#   COMICLAW_CHAT_COMPLETE_STUB=1   — skip OpenClaw; echo a stub reply (ops smoke)
#   COMICLAW_WAKE_LOG               — append parse/http lines
set -euo pipefail

TOKEN_FILE="${COMICLAW_HOOKS_TOKEN_FILE:-$HOME/.config/comiclaw/hooks.token}"
WAKE_URL="${OPENCLAW_WAKE_URL:-http://127.0.0.1:10122/hooks/agent}"
TIMEOUT_SEC="${COMICLAW_CHAT_COMPLETE_TIMEOUT:-110}"
LOG="${COMICLAW_WAKE_LOG:-$HOME/logs/comiclaw/acn-wake.log}"
RESP_FILE="${COMICLAW_CHAT_COMPLETE_RESP:-/tmp/chat-complete-resp.json}"
WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/chat-complete.XXXXXX")
trap 'rm -rf "$WORKDIR"' EXIT
mkdir -p "$(dirname "$LOG")"

BODY=$(cat || true)
if [[ -z "${BODY//[[:space:]]/}" ]]; then
  echo "chat-complete: empty stdin (expected NormalizedEvent JSON)" >&2
  exit 2
fi

ACN_CHAT_BODY="$BODY" WORKDIR="$WORKDIR" TIMEOUT_SEC="$TIMEOUT_SEC" python3 <<'PY'
import json, os, sys

raw = os.environ.get("ACN_CHAT_BODY", "") or ""
workdir = os.environ["WORKDIR"]
timeout_sec = int(os.environ.get("TIMEOUT_SEC") or "110")

try:
    ev = json.loads(raw) if raw.strip() else {}
except Exception as e:
    print(f"chat-complete: invalid_json:{e}", file=sys.stderr)
    sys.exit(2)

CTRL_RE = __import__("re").compile(r"[\x00-\x1f\x7f]+")


def clean(s, n=4000):
    if not isinstance(s, str):
        return ""
    s = CTRL_RE.sub(" ", s).strip()
    return s[:n] if len(s) > n else s


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


chat = ev.get("chat") if isinstance(ev.get("chat"), dict) else {}
chat_id = (
    dig(ev, "chat.chat_id")
    or dig(chat, "chat_id")
    or dig(ev, "metadata.agentplanet.chat_id")
    or dig(ev, "raw.params.message.metadata.agentplanet.chat_id")
)
user_text = dig(ev, "chat.user_text") or dig(chat, "user_text") or ""
if not user_text:
    raw_obj = ev.get("raw") if isinstance(ev.get("raw"), dict) else {}
    params = raw_obj.get("params") if isinstance(raw_obj.get("params"), dict) else {}
    msg = params.get("message") if isinstance(params.get("message"), dict) else None
    if isinstance(msg, dict) and isinstance(msg.get("parts"), list):
        chunks = [
            p["text"].strip()
            for p in msg["parts"]
            if isinstance(p, dict) and isinstance(p.get("text"), str) and p["text"].strip()
        ]
        user_text = "\n".join(chunks)

user_text = clean(user_text, 4000)
msg_id = dig(ev, "message_id", "messageId") or ""

if not chat_id:
    print("chat-complete: missing_chat_id", file=sys.stderr)
    sys.exit(2)
if not user_text:
    print("chat-complete: missing_user_text", file=sys.stderr)
    sys.exit(2)

message = (
    f"Interfaze chat (chat_id={chat_id}; message_id={msg_id}). "
    f"Reply as comiclaw in the user's language. Be concise and helpful. "
    f"Do NOT run production-worker, chat-writeback.sh, or edit openclaw/systemd. "
    f"Do NOT mention internal ids unless the user asks.\n\n"
    f"User:\n{user_text}"
)

hooks = {
    "message": message,
    "name": "Interfaze",
    "wakeMode": "now",
    "agentId": "main",
    "deliver": False,
    "waitForResult": True,
    "timeoutSeconds": timeout_sec,
    # Suppress summary spam into the operator's main OpenClaw session.
    "announceToMain": False,
    "meta": {
        "acn": {
            "kind": "chat_complete",
            "chat_id": chat_id,
            "message_id": msg_id,
        }
    },
}
# Optional: only if hooks.allowedSessionKeyPrefixes includes hook:interfaze:
#   COMICLAW_CHAT_SESSION_KEY=1
if os.environ.get("COMICLAW_CHAT_SESSION_KEY", "").strip() in ("1", "true", "yes"):
    hooks["sessionKey"] = f"hook:interfaze:chat:{chat_id}"
meta = {
    "chat_id": chat_id,
    "message_id": msg_id,
    "user_preview": clean(user_text, 200),
}
with open(os.path.join(workdir, "hooks.json"), "w", encoding="utf-8") as f:
    json.dump(hooks, f, ensure_ascii=False)
with open(os.path.join(workdir, "meta.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False)
PY

CHAT_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["chat_id"])' "$WORKDIR/meta.json")
MSG_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("message_id") or "")' "$WORKDIR/meta.json")
USER_PREVIEW=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("user_preview") or "")' "$WORKDIR/meta.json")

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "$ts chat_complete_start chat_id=$CHAT_ID message_id=$MSG_ID preview=$USER_PREVIEW" >> "$LOG"

if [[ "${COMICLAW_CHAT_COMPLETE_STUB:-}" == "1" ]]; then
  CONTENT="[stub] comiclaw received: ${USER_PREVIEW}"
  CONTENT="$CONTENT" python3 -c 'import json,os; print(json.dumps({"content": os.environ["CONTENT"]}, ensure_ascii=False))'
  echo "$ts chat_complete_stub chat_id=$CHAT_ID" >> "$LOG"
  exit 0
fi

if [[ ! -r "$TOKEN_FILE" ]]; then
  echo "chat-complete: missing readable token file: $TOKEN_FILE" >&2
  exit 1
fi
TOKEN=$(cat "$TOKEN_FILE")

code=$(curl -sS -m "$TIMEOUT_SEC" -o "$RESP_FILE" -w '%{http_code}' -X POST "$WAKE_URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @"$WORKDIR/hooks.json" || echo 000)

echo "$ts chat_complete_http=$code url=$WAKE_URL chat_id=$CHAT_ID" >> "$LOG"

case "$code" in
  2*) ;;
  *)
    echo "chat-complete: OpenClaw http=$code url=$WAKE_URL" >&2
    head -c 400 "$RESP_FILE" 2>/dev/null >&2 || true
    echo >&2
    exit 1
    ;;
esac

CONTENT=$(
  RESP_FILE="$RESP_FILE" python3 <<'PY'
import json, os, sys

path = os.environ["RESP_FILE"]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"chat-complete: invalid OpenClaw JSON: {e}", file=sys.stderr)
    sys.exit(3)

if not isinstance(data, dict):
    print("chat-complete: OpenClaw response is not a JSON object", file=sys.stderr)
    sys.exit(3)

status = data.get("status")
# Async accept without waitForResult — cannot recover text here.
# Also catch the older/default shape: {"ok": true, "runId": "..."} with no result.
async_ack = status == "accepted" or (
    data.get("ok") is True
    and isinstance(data.get("runId"), str)
    and not (isinstance(data.get("result"), str) and data["result"].strip())
    and not (isinstance(data.get("content"), str) and data["content"].strip())
)
if async_ack and not (
    isinstance(data.get("result"), str) and data["result"].strip()
):
    print(
        "chat-complete: OpenClaw returned async ack without result "
        f"(status={status!r}, keys={sorted(data.keys())}). "
        "Need waitForResult=true returning result text; "
        "if sessionKey is blocked by hooks policy, omit it "
        "(default now) or allow prefix hook:interfaze:.",
        file=sys.stderr,
    )
    sys.exit(3)
if status == "error":
    err = data.get("error") or data.get("message") or data
    print(f"chat-complete: OpenClaw status=error: {err!r}"[:400], file=sys.stderr)
    sys.exit(3)


def pick_text(obj):
    """Prefer result/content/reply/text — never treat request 'message' as reply."""
    if obj is None:
        return None
    if isinstance(obj, str) and obj.strip():
        return obj.strip()
    if not isinstance(obj, dict):
        return None
    for k in ("result", "content", "reply", "text", "output"):
        v = obj.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    for k in ("data", "response", "agent"):
        if k in obj:
            inner = pick_text(obj[k])
            if inner:
                return inner
    return None


content = pick_text(data)
if not content:
    print(
        "chat-complete: no reply text in OpenClaw response "
        f"(status={status!r}). Need waitForResult on /hooks/agent, "
        "or set COMICLAW_CHAT_COMPLETE_STUB=1 for smoke.",
        file=sys.stderr,
    )
    sys.exit(3)
if content.strip().lower() in ("accepted", "ok", "ok."):
    print("chat-complete: refusing transport ACK as content", file=sys.stderr)
    sys.exit(3)
print(content)
PY
)

CONTENT="$CONTENT" python3 -c 'import json,os; print(json.dumps({"content": os.environ["CONTENT"]}, ensure_ascii=False))'
echo "$ts chat_complete_ok chat_id=$CHAT_ID bytes=${#CONTENT}" >> "$LOG"
exit 0
