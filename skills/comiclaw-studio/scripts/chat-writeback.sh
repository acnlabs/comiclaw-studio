#!/usr/bin/env bash
# Write an Interfaze / AgentPlanet chat reply (generic Chat Gateway contract).
#
# Usage:
#   chat-writeback.sh <chat_id> <<'EOF'
#   Your reply text
#   EOF
#   chat-writeback.sh <chat_id> "short reply"
#
# Env (host secrets — do not commit):
#   AGENTPLANET_API_BASE     default http://127.0.0.1:8000
#   AGENTPLANET_INTERNAL_TOKEN   required (AgentPlanet INTERNAL_API_TOKEN)
#   COMICLAW_ACN_AGENT_ID    required (this host's ACN agent_id)
#   COMICLAW_WAKE_LOG        optional log path
#
# Spec: AgentPlanet docs/architecture/chat-agent-writeback-v0.md
set -euo pipefail

CHAT_ID="${1:-}"
if [[ -z "$CHAT_ID" ]]; then
  echo "usage: chat-writeback.sh <chat_id> [reply]   # or reply on stdin" >&2
  exit 2
fi
shift || true

if [[ $# -gt 0 ]]; then
  CONTENT="$*"
else
  CONTENT=$(cat || true)
fi
CONTENT=$(printf '%s' "$CONTENT" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
if [[ -z "$CONTENT" ]]; then
  echo "chat-writeback: empty content" >&2
  exit 2
fi

API_BASE="${AGENTPLANET_API_BASE:-http://127.0.0.1:8000}"
API_BASE="${API_BASE%/}"
TOKEN="${AGENTPLANET_INTERNAL_TOKEN:-}"
AGENT_ID="${COMICLAW_ACN_AGENT_ID:-${ACN_AGENT_ID:-}}"
LOG="${COMICLAW_WAKE_LOG:-$HOME/logs/comiclaw/acn-wake.log}"
mkdir -p "$(dirname "$LOG")"

if [[ -z "$TOKEN" ]]; then
  echo "chat-writeback: set AGENTPLANET_INTERNAL_TOKEN" >&2
  exit 1
fi
if [[ -z "$AGENT_ID" ]]; then
  echo "chat-writeback: set COMICLAW_ACN_AGENT_ID (or ACN_AGENT_ID)" >&2
  exit 1
fi

BODY=$(CONTENT="$CONTENT" python3 -c 'import json,os; print(json.dumps({"content": os.environ["CONTENT"]}, ensure_ascii=False))')
URL="${API_BASE}/api/chats/${CHAT_ID}/agent-messages?agent_id=${AGENT_ID}"
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
code=$(curl -sS -m 60 -o /tmp/chat-writeback-resp.json -w '%{http_code}' -X POST "$URL" \
  -H "X-Internal-Token: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY" || echo 000)

echo "$ts chat_writeback http=$code chat_id=$CHAT_ID agent_id=$AGENT_ID" >> "$LOG"

case "$code" in
  201|200) exit 0 ;;
  *)
    echo "chat-writeback failed http=$code url=$URL" >&2
    head -c 400 /tmp/chat-writeback-resp.json 2>/dev/null >&2 || true
    echo >&2
    exit 1
    ;;
esac
