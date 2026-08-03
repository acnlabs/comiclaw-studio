#!/usr/bin/env bash
# ACN CLI `--chat-complete-exec` → OpenClaw reply text → stdout {"content":"..."}.
#
# Contract (AgentPlanet chat-agent-writeback-v0 / acn listen --chat-writeback):
#   stdin  = NormalizedEvent JSON (includes .chat.chat_id, .chat.user_text, …)
#   stdout = JSON {"content":"<final reply text>"}
#   stderr = diagnostics; non-zero exit on failure
#
# IMPORTANT: do NOT use `python3 <<'PY'` while reading this script's stdin —
# the heredoc steals the event body. Pass BODY via env (same pattern as wake).
#
# Why CLI-first:
#   Stock OpenClaw POST /hooks/agent ignores waitForResult and only returns
#   {"ok":true,"runId":"..."}. `openclaw agent --json` blocks until the turn
#   finishes and returns assistant text (no PR #67433 required).
#
# Prerequisites:
#   openclaw CLI on PATH, talking to the same Gateway as Comiclaw
#   (optional fallback) ~/.config/comiclaw/hooks.token + OPENCLAW_WAKE_URL
#
# Optional:
#   COMICLAW_CHAT_COMPLETE_VIA=cli|hooks|auto   default: auto (cli if present)
#   COMICLAW_CHAT_COMPLETE_TIMEOUT              seconds (default 110)
#   COMICLAW_CHAT_COMPLETE_STUB=1               smoke without OpenClaw
#   COMICLAW_CHAT_SESSION_KEY=1                 pass isolated session key to CLI/hooks
#   COMICLAW_OPENCLAW_AGENT                     default: main
#   COMICLAW_WAKE_LOG                           append diagnostics
set -euo pipefail

TOKEN_FILE="${COMICLAW_HOOKS_TOKEN_FILE:-$HOME/.config/comiclaw/hooks.token}"
WAKE_URL="${OPENCLAW_WAKE_URL:-http://127.0.0.1:10122/hooks/agent}"
TIMEOUT_SEC="${COMICLAW_CHAT_COMPLETE_TIMEOUT:-110}"
LOG="${COMICLAW_WAKE_LOG:-$HOME/logs/comiclaw/acn-wake.log}"
RESP_FILE="${COMICLAW_CHAT_COMPLETE_RESP:-/tmp/chat-complete-resp.json}"
AGENT_ID="${COMICLAW_OPENCLAW_AGENT:-main}"
VIA="${COMICLAW_CHAT_COMPLETE_VIA:-auto}"
WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/chat-complete.XXXXXX")
trap 'rm -rf "$WORKDIR"' EXIT
mkdir -p "$(dirname "$LOG")"

BODY=$(cat || true)
if [[ -z "${BODY//[[:space:]]/}" ]]; then
  echo "chat-complete: empty stdin (expected NormalizedEvent JSON)" >&2
  exit 2
fi

ACN_CHAT_BODY="$BODY" WORKDIR="$WORKDIR" TIMEOUT_SEC="$TIMEOUT_SEC" \
AGENT_ID="$AGENT_ID" python3 <<'PY'
import json, os, sys

raw = os.environ.get("ACN_CHAT_BODY", "") or ""
workdir = os.environ["WORKDIR"]
timeout_sec = int(os.environ.get("TIMEOUT_SEC") or "110")
agent_id = (os.environ.get("AGENT_ID") or "main").strip() or "main"

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

session_key = None
if os.environ.get("COMICLAW_CHAT_SESSION_KEY", "").strip() in ("1", "true", "yes"):
    session_key = f"interfaze-chat-{chat_id}"

hooks = {
    "message": message,
    "name": "Interfaze",
    "wakeMode": "now",
    "agentId": agent_id,
    "deliver": False,
    "waitForResult": True,
    "timeoutSeconds": timeout_sec,
    "announceToMain": False,
    "meta": {
        "acn": {
            "kind": "chat_complete",
            "chat_id": chat_id,
            "message_id": msg_id,
        }
    },
}
if session_key:
    # hooks prefixes often require hook:… — only send when ops opts in
    hooks["sessionKey"] = f"hook:{session_key}"

meta = {
    "chat_id": chat_id,
    "message_id": msg_id,
    "user_preview": clean(user_text, 200),
    "agent_id": agent_id,
    "session_key": session_key or "",
}
with open(os.path.join(workdir, "prompt.txt"), "w", encoding="utf-8") as f:
    f.write(message)
with open(os.path.join(workdir, "hooks.json"), "w", encoding="utf-8") as f:
    json.dump(hooks, f, ensure_ascii=False)
with open(os.path.join(workdir, "meta.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False)
PY

CHAT_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["chat_id"])' "$WORKDIR/meta.json")
MSG_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("message_id") or "")' "$WORKDIR/meta.json")
USER_PREVIEW=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("user_preview") or "")' "$WORKDIR/meta.json")
SESSION_KEY=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("session_key") or "")' "$WORKDIR/meta.json")

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "$ts chat_complete_start chat_id=$CHAT_ID message_id=$MSG_ID via=$VIA preview=$USER_PREVIEW" >> "$LOG"

if [[ "${COMICLAW_CHAT_COMPLETE_STUB:-}" == "1" ]]; then
  CONTENT="[stub] comiclaw received: ${USER_PREVIEW}"
  CONTENT="$CONTENT" python3 -c 'import json,os; print(json.dumps({"content": os.environ["CONTENT"]}, ensure_ascii=False))'
  echo "$ts chat_complete_stub chat_id=$CHAT_ID" >> "$LOG"
  exit 0
fi

pick_via() {
  case "$VIA" in
    cli|hooks) echo "$VIA" ;;
    auto)
      if command -v openclaw >/dev/null 2>&1; then
        echo cli
      else
        echo hooks
      fi
      ;;
    *)
      echo "chat-complete: unknown COMICLAW_CHAT_COMPLETE_VIA=$VIA (use cli|hooks|auto)" >&2
      exit 2
      ;;
  esac
}

RESOLVED_VIA=$(pick_via)
echo "$ts chat_complete_via=$RESOLVED_VIA chat_id=$CHAT_ID" >> "$LOG"

extract_content() {
  # $1 = path to OpenClaw JSON → stdout: reply text; exit 3 if missing
  # IMPORTANT: do not read JSON from stdin — python3 <<'PY' heredoc steals stdin
  # (same class of bug as wake scripts; yields empty {} / keys=[]).
  local path="${1:-}"
  if [[ -z "$path" || ! -r "$path" ]]; then
    echo "chat-complete: extract_content missing readable file: ${path:-<empty>}" >&2
    return 3
  fi
  OC_RESP_FILE="$path" python3 <<'PY'
import json, os, sys

path = os.environ.get("OC_RESP_FILE") or ""
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"chat-complete: invalid OpenClaw JSON: {e}", file=sys.stderr)
    sys.exit(3)

if not isinstance(data, dict):
    print("chat-complete: OpenClaw response is not a JSON object", file=sys.stderr)
    sys.exit(3)


def pick_text(obj, depth=0):
    if depth > 6 or obj is None:
        return None
    if isinstance(obj, str) and obj.strip():
        return obj.strip()
    if isinstance(obj, list):
        for item in obj:
            inner = pick_text(item, depth + 1)
            if inner:
                return inner
        return None
    if not isinstance(obj, dict):
        return None
    for k in ("result", "content", "reply", "text", "output", "final"):
        v = obj.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    payloads = obj.get("payloads")
    if isinstance(payloads, list):
        for p in payloads:
            if isinstance(p, dict):
                for k in ("text", "content", "reply"):
                    v = p.get(k)
                    if isinstance(v, str) and v.strip():
                        return v.strip()
            elif isinstance(p, str) and p.strip():
                return p.strip()
    for k in ("data", "response", "agent", "message", "result"):
        if k in obj:
            inner = pick_text(obj[k], depth + 1)
            if inner:
                return inner
    return None


status = data.get("status")
# Pure async ack from /hooks/agent — no usable text.
async_ack = status == "accepted" or (
    data.get("ok") is True
    and isinstance(data.get("runId"), str)
    and pick_text(data) is None
)
if async_ack:
    print(
        "chat-complete: OpenClaw returned async ack without result "
        f"(status={status!r}, keys={sorted(data.keys())}).",
        file=sys.stderr,
    )
    sys.exit(3)
if status == "error":
    err = data.get("error") or data.get("message") or data
    print(f"chat-complete: OpenClaw status=error: {err!r}"[:400], file=sys.stderr)
    sys.exit(3)

content = pick_text(data)
if not content:
    print(
        "chat-complete: no reply text in OpenClaw response "
        f"(status={status!r}, keys={sorted(data.keys())}).",
        file=sys.stderr,
    )
    sys.exit(3)
if content.strip().lower() in ("accepted", "ok", "ok."):
    print("chat-complete: refusing transport ACK as content", file=sys.stderr)
    sys.exit(3)
print(content)
PY
}

# openclaw gateway call --timeout is milliseconds (error: "timeout after 110ms").
# openclaw agent --timeout is seconds (docs + pong-cli proof).
rpc_timeout_ms() {
  echo $((TIMEOUT_SEC * 1000))
}

complete_via_cli() {
  local oc_bin
  oc_bin=$(command -v openclaw || true)
  if [[ -z "$oc_bin" ]]; then
    echo "chat-complete: openclaw not on PATH" >&2
    echo "$ts chat_complete_cli_fail reason=no_openclaw" >> "$LOG"
    return 1
  fi
  local args=(agent --agent "$AGENT_ID" --message-file "$WORKDIR/prompt.txt" --timeout "$TIMEOUT_SEC" --json)
  if [[ -n "$SESSION_KEY" ]]; then
    args+=(--session-key "$SESSION_KEY")
  fi
  # No --deliver: Interfaze writeback is handled by ACN CLI, not OpenClaw channels.
  local t0 t1
  t0=$(date +%s)
  set +e
  "$oc_bin" "${args[@]}" >"$RESP_FILE" 2>"$WORKDIR/cli.err"
  local rc=$?
  set -e
  t1=$(date +%s)
  echo "$ts chat_complete_cli rc=$rc dur_s=$((t1 - t0)) bin=$oc_bin bytes=$(wc -c <"$RESP_FILE" 2>/dev/null || echo 0)" >> "$LOG"
  if [[ $rc -ne 0 ]]; then
    echo "chat-complete: openclaw agent failed rc=$rc" >&2
    head -c 600 "$WORKDIR/cli.err" >&2 || true
    echo >&2
    # Persist stderr for ops (wake log).
    head -c 600 "$WORKDIR/cli.err" >>"$LOG" || true
    echo >>"$LOG"
    return 1
  fi
  if ! CONTENT=$(extract_content "$RESP_FILE" 2>"$WORKDIR/extract.err"); then
    echo "$ts chat_complete_cli_extract_fail" >> "$LOG"
    head -c 400 "$WORKDIR/extract.err" >>"$LOG" || true
    echo >>"$LOG"
    head -c 400 "$RESP_FILE" >>"$LOG" || true
    echo >>"$LOG"
    return 1
  fi
  return 0
}

wait_run_then_history() {
  local run_id="$1"
  [[ -n "$run_id" ]] || return 1
  command -v openclaw >/dev/null 2>&1 || return 1

  local wait_ms rpc_ms
  wait_ms=$((TIMEOUT_SEC * 1000))
  rpc_ms=$(rpc_timeout_ms)
  set +e
  openclaw gateway call agent.wait \
    --params "{\"runId\":\"$run_id\",\"timeoutMs\":$wait_ms}" \
    --timeout "$rpc_ms" >"$WORKDIR/wait.json" 2>"$WORKDIR/wait.err"
  local wrc=$?
  set -e
  echo "$ts chat_complete_agent_wait rc=$wrc runId=$run_id rpc_ms=$rpc_ms" >> "$LOG"
  if [[ $wrc -ne 0 ]]; then
    head -c 400 "$WORKDIR/wait.err" >>"$LOG" || true
    echo >>"$LOG"
    return 1
  fi

  # Prefer text embedded in wait payload if present.
  if CONTENT=$(extract_content "$WORKDIR/wait.json" 2>/dev/null); then
    return 0
  fi

  # Fallback: newest assistant text from sessions history (main / opted session).
  local hist_key="${SESSION_KEY:-main}"
  set +e
  openclaw gateway call sessions.history \
    --params "{\"sessionKey\":\"$hist_key\",\"limit\":8}" \
    --timeout 30000 >"$WORKDIR/hist.json" 2>"$WORKDIR/hist.err"
  local hrc=$?
  if [[ $hrc -ne 0 ]]; then
    openclaw gateway call chat.history \
      --params "{\"sessionKey\":\"$hist_key\",\"limit\":8}" \
      --timeout 30000 >"$WORKDIR/hist.json" 2>"$WORKDIR/hist.err"
    hrc=$?
  fi
  set -e
  echo "$ts chat_complete_history rc=$hrc sessionKey=$hist_key" >> "$LOG"
  [[ $hrc -eq 0 ]] || return 1

  CONTENT=$(
    python3 <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text(encoding="utf-8"))

def messages(obj):
    if isinstance(obj, list):
        return obj
    if not isinstance(obj, dict):
        return []
    for k in ("messages", "items", "history", "result", "payloads"):
        v = obj.get(k)
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            inner = messages(v)
            if inner:
                return inner
    return []

def text_of(m):
    if isinstance(m, str):
        return m.strip()
    if not isinstance(m, dict):
        return ""
    role = (m.get("role") or m.get("sender") or m.get("type") or "").lower()
    if role and role not in ("assistant", "agent", "model", "ai"):
        # still allow if content looks assistant-only lists without role
        pass
    for k in ("text", "content", "reply"):
        v = m.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list):
            parts = []
            for p in v:
                if isinstance(p, str) and p.strip():
                    parts.append(p.strip())
                elif isinstance(p, dict):
                    t = p.get("text") or p.get("content")
                    if isinstance(t, str) and t.strip():
                        parts.append(t.strip())
            if parts:
                return "\n".join(parts)
    return ""

msgs = messages(data)
# Prefer last assistant-like message; else last non-empty text.
chosen = ""
for m in reversed(msgs):
    if not isinstance(m, dict):
        t = text_of(m)
        if t:
            chosen = t
            break
        continue
    role = (m.get("role") or m.get("sender") or m.get("type") or "").lower()
    t = text_of(m)
    if not t:
        continue
    if role in ("assistant", "agent", "model", "ai") or not role:
        chosen = t
        if role in ("assistant", "agent", "model", "ai"):
            break
if not chosen or chosen.strip().lower() in ("accepted", "ok", "ok."):
    sys.exit(3)
print(chosen)
PY
    "$WORKDIR/hist.json"
  ) || return 1
  return 0
}

complete_via_hooks() {
  if [[ ! -r "$TOKEN_FILE" ]]; then
    echo "chat-complete: missing readable token file: $TOKEN_FILE" >&2
    return 1
  fi
  local token
  token=$(cat "$TOKEN_FILE")

  set +e
  local code
  code=$(curl -sS -m "$TIMEOUT_SEC" -o "$RESP_FILE" -w '%{http_code}' -X POST "$WAKE_URL" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d @"$WORKDIR/hooks.json" || echo 000)
  set -e
  echo "$ts chat_complete_http=$code url=$WAKE_URL chat_id=$CHAT_ID" >> "$LOG"

  case "$code" in
    2*) ;;
    *)
      echo "chat-complete: OpenClaw http=$code url=$WAKE_URL" >&2
      head -c 400 "$RESP_FILE" 2>/dev/null >&2 || true
      echo >&2
      return 1
      ;;
  esac

  if CONTENT=$(extract_content "$RESP_FILE" 2>/dev/null); then
    return 0
  fi

  # Async ack → wait on runId + read history (stock OpenClaw without waitForResult).
  local run_id
  run_id=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("runId") or "")' "$RESP_FILE")
  if [[ -n "$run_id" ]] && wait_run_then_history "$run_id"; then
    echo "$ts chat_complete_poll_ok runId=$run_id chat_id=$CHAT_ID" >> "$LOG"
    return 0
  fi

  echo "chat-complete: hooks async ack and poll failed; prefer COMICLAW_CHAT_COMPLETE_VIA=cli" >&2
  head -c 400 "$RESP_FILE" >&2 || true
  echo >&2
  return 1
}

CONTENT=""
USED_VIA="$RESOLVED_VIA"
case "$RESOLVED_VIA" in
  cli)
    if ! complete_via_cli; then
      if [[ "$VIA" == "auto" ]]; then
        echo "chat-complete: CLI path failed; trying hooks+poll" >&2
        echo "$ts chat_complete_fallback=hooks" >> "$LOG"
        complete_via_hooks || exit 3
        USED_VIA=hooks
      else
        # Explicit cli: do not fall back (hooks async ack is flaky without waitForResult).
        echo "chat-complete: CLI path failed (COMICLAW_CHAT_COMPLETE_VIA=cli)" >&2
        exit 3
      fi
    fi
    ;;
  hooks)
    complete_via_hooks || exit 3
    ;;
esac

CONTENT="$CONTENT" python3 -c 'import json,os; print(json.dumps({"content": os.environ["CONTENT"]}, ensure_ascii=False))'
echo "$ts chat_complete_ok chat_id=$CHAT_ID via=$USED_VIA bytes=${#CONTENT}" >> "$LOG"
exit 0
