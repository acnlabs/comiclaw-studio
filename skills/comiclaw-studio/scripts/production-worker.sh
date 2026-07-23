#!/usr/bin/env bash
# 主 comiclaw / 生产 Agent 接单助手
#
# 推荐运行形态(实时为主):
#   1) Mode A: 常驻 acn listen;收到 task_request / invite 立刻处理
#   2) Mode B: acn listen --forward http://127.0.0.1:<local-a2a-port>
#   3) 本脚本 reconcile 作兜底对账(漏推、重启后扫尾巴)
# 运维收口见仓库 docs/ops-production.md
#
# 依赖:
#   - acn CLI 已登录为生产 Agent(ACN_PROD)
#   - STUDIO_API_KEY / STUDIO_BASE_URL(本目录 studio.sh)
#   - 可选: ACN_SUBNET_SLUG(默认 comiclaw-internal)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
S="$DIR/studio.sh"
SUBNET="${ACN_SUBNET_SLUG:-comiclaw-internal}"

if [[ ! -x "$S" ]]; then
  chmod +x "$S" 2>/dev/null || true
fi

usage() {
  cat <<'EOF'
用法: production-worker.sh <command> [args]

  listen-hint              打印推荐的实时接单常驻命令(acn listen)
  reconcile [limit]        兜底:列出 open 任务里属于本 subnet 的项(默认 20)
  show <acnTaskId>         打印任务关键字段(metadata.studio / invite / status)
  accept <acnTaskId>       accept 指定任务
  handle <acnTaskId>       show + 打印按 type 应执行的步骤清单(不自动调即梦)

实时路径(优先):
  acn listen
  # Mode B: acn listen --forward http://127.0.0.1:PORT
  # 收到 task_request / 被 invite 的通知后:
  ./production-worker.sh handle <acnTaskId>
  # 按提示执行完再:
  acn tasks submit <acnTaskId> --result "..."

运维收口: docs/ops-production.md
EOF
}

need_acn() {
  if ! command -v acn >/dev/null 2>&1; then
    echo "error: acn CLI not found in PATH" >&2
    exit 1
  fi
}

cmd="${1:-}"
case "$cmd" in
  listen-hint)
    cat <<EOF
# Mode A — 主 comiclaw 推荐常驻(实时推送,无需公网入站):
acn listen

# Mode B — 本地 A2A handler 再转发:
# acn listen --forward http://127.0.0.1:PORT

# 收到 invite / task_request 后立刻:
$DIR/production-worker.sh handle <acnTaskId>
# 做完交付物后:
acn tasks submit <acnTaskId> --result '...'

# 兜底对账(每 5–15 分钟或重启后跑一次):
$DIR/production-worker.sh reconcile

# 运维收口(systemd / 验收清单): docs/ops-production.md
EOF
    ;;

  reconcile)
    need_acn
    limit="${2:-20}"
    echo "subnet=$SUBNET limit=$limit" >&2
    # acn CLI 输出格式随版本可能变化;优先尝试 JSON,失败则原文打印
    if acn tasks list --status open --limit "$limit" --json >/tmp/acn-open-tasks.json 2>/dev/null; then
      python3 - "$SUBNET" <<'PY'
import json,sys
subnet=sys.argv[1]
raw=open("/tmp/acn-open-tasks.json").read()
try:
    d=json.loads(raw)
except Exception:
    print(raw); sys.exit(0)
tasks=d.get("tasks") if isinstance(d,dict) else d
if not isinstance(tasks,list):
    tasks=[]
matched=[]
for t in tasks:
    if (t.get("subnet_slug") or t.get("subnet_id")) == subnet:
        matched.append(t)
print(f"open_in_subnet={len(matched)}")
for t in matched:
    meta=(t.get("metadata") or {}).get("studio") or {}
    print("-", t.get("task_id"), t.get("status"), meta.get("type"), "invited=", t.get("invited_agent_ids"), "title=", (t.get("title") or "")[:60])
PY
    else
      echo "(no --json flag; raw list below — 请人工筛 subnet=$SUBNET)" >&2
      acn tasks list --status open --limit "$limit" || true
    fi
    ;;

  show|handle|accept)
    need_acn
    tid="${2:-}"
    if [[ -z "$tid" ]]; then
      echo "error: acnTaskId required" >&2
      exit 1
    fi
    if [[ "$cmd" == "accept" ]]; then
      acn tasks accept "$tid"
      exit 0
    fi
    # show / handle
    if acn tasks get "$tid" --json >/tmp/acn-task.json 2>/dev/null; then
      :
    else
      acn tasks get "$tid" | tee /tmp/acn-task.txt
      # 非 JSON 时仍给出通用步骤
      if [[ "$cmd" == "handle" ]]; then
        cat <<EOF

--- next steps ---
1) acn tasks accept $tid
2) 读 metadata.studio (project_id / type / input)
3) WRITE_SCRIPT: studio.sh push-script → set-stage ASSETS → submit
   GENERATE_IMAGE: studio.sh charge(comiclaw:gen:$tid) → dreamina → upload-file → add-asset → submit
4) acn tasks submit $tid --result '...'
EOF
      fi
      exit 0
    fi
    python3 - "$tid" "$cmd" "$S" <<'PY'
import json,sys
tid,cmd,studio_sh=sys.argv[1:4]
d=json.load(open("/tmp/acn-task.json"))
# some CLIs wrap {task: {...}}
t=d.get("task") if isinstance(d.get("task"), dict) else d
meta=(t.get("metadata") or {}).get("studio") or {}
print("task_id=", t.get("task_id") or tid)
print("status=", t.get("status"))
print("subnet_slug=", t.get("subnet_slug"))
print("use_escrow=", t.get("use_escrow"))
print("invited_agent_ids=", t.get("invited_agent_ids"))
print("assignee_id=", t.get("assignee_id"))
print("studio.type=", meta.get("type"))
print("studio.project_id=", meta.get("project_id"))
print("studio.input=", json.dumps(meta.get("input") or {}, ensure_ascii=False))
if cmd=="handle":
    typ=meta.get("type") or "?"
    pid=meta.get("project_id") or "<projectId>"
    print("\n--- handle checklist ---")
    print(f"1) acn tasks accept {tid}")
    print(f"2) $S set-status {pid} '主工作室处理中…'".replace("$S", studio_sh))
    if typ=="WRITE_SCRIPT":
        print(f"3) 写剧本后: {studio_sh} push-script {pid} '{{\"title\":\"...\",\"content\":\"...\",\"changeLog\":\"ACN task\"}}'")
        print(f"4) {studio_sh} set-stage {pid} ASSETS")
    elif typ=="GENERATE_IMAGE":
        print(f"3) {studio_sh} charge {pid} '{{\"action\":\"asset_generate\",\"units\":1,\"provider\":\"jimeng\",\"idempotencyKey\":\"comiclaw:gen:{tid}\"}}'")
        print("   # 非 2xx 不得出图;读响应 submitHint 写入 submit")
        print("4) dreamina 出图 → upload-file → add-asset")
    else:
        print("3) 按 metadata.studio.type 执行对应生产步骤")
    print(f"5) {studio_sh} set-status {pid} ''")
    print(f"6) acn tasks submit {tid} --result 'ok; type={typ}; project={pid}'")
PY
    ;;

  ""|-h|--help|help) usage ;;
  *) echo "error: unknown command '$cmd'" >&2; usage >&2; exit 1 ;;
esac
