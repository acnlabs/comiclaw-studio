#!/usr/bin/env bash
# 出图/出视频前硬闸:先 charge,非 2xx 立即失败退出,绝不继续上游。
# 用法:
#   charge-before-generate.sh <projectId> <acnTaskId> [units]
# 环境同本目录 studio.sh（ACN_API_KEY + ACN_TASK_ID）。
# 成功:stdout 打印 JSON(含 submitHint),exit 0。
# 失败:stdout 仍尽量打印响应体(含 submitHint),stderr 一行 CHARGE_FAILED,exit 非 0。
# 调用方必须先判断 exit code 再跑即梦;推荐:
#   CHARGE=$(…/charge-before-generate.sh "$pid" "$tid") || {
#     acn tasks submit "$tid" --result "charge failed; …"
#     exit 1
#   }
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
S="${STUDIO_SH:-$ROOT/studio.sh}"

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <projectId> <acnTaskId> [units]" >&2
  exit 2
fi

pid="$1"
tid="$2"
units="${3:-1}"

if ! [[ "$units" =~ ^[1-9][0-9]*$ ]]; then
  echo "error: units must be a positive integer" >&2
  exit 2
fi

# 幂等键固定 comiclaw:gen:<acnTaskId>,与 skill / 验收约定一致
key="comiclaw:gen:${tid}"
body=$(python3 -c 'import json,sys; print(json.dumps({
  "action":"asset_generate",
  "units":int(sys.argv[1]),
  "provider":"jimeng",
  "idempotencyKey":sys.argv[2],
}))' "$units" "$key")

set +e
out=$("$S" charge "$pid" "$body" 2>/tmp/comiclaw-charge-before-generate.err)
rc=$?
set -e

# studio.sh / curl 失败时错误可能在 stderr;响应体常仍在 stdout
if [[ -n "$out" ]]; then
  printf '%s\n' "$out"
fi

if [[ $rc -ne 0 ]]; then
  hint=$(printf '%s' "$out" | python3 -c 'import sys,json
raw=sys.stdin.read().strip()
# curl --fail-with-body 可能在 JSON 前夹杂 "curl: (22) …"
start=raw.find("{")
if start<0:
  raise SystemExit
print(json.loads(raw[start:]).get("submitHint") or "")
' 2>/dev/null || true)
  echo "CHARGE_FAILED rc=$rc project=$pid task=$tid key=$key submitHint=${hint:-}" >&2
  if [[ -s /tmp/comiclaw-charge-before-generate.err ]]; then
    # 不把密钥打进日志;stderr 通常只有 curl 状态行
    head -c 400 /tmp/comiclaw-charge-before-generate.err >&2 || true
    echo >&2
  fi
  exit "$rc"
fi

# 双保险:2xx 但业务 status 非 SUCCESS 也停(不应出现,防回归)
status=$(printf '%s' "$out" | python3 -c 'import sys,json
raw=sys.stdin.read().strip(); start=raw.find("{")
d=json.loads(raw[start:])
print((d.get("ref") or {}).get("status") or d.get("consumption",{}).get("status") or "")
' 2>/dev/null || true)
if [[ -n "$status" && "$status" != "SUCCESS" ]]; then
  echo "CHARGE_FAILED unexpected status=$status project=$pid task=$tid" >&2
  exit 1
fi

exit 0
