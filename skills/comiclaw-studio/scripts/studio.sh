#!/usr/bin/env bash
# ComicLaw Studio API 客户端(供 OpenClaw 实例调用)
# 依赖环境变量:
#   STUDIO_BASE_URL  Studio 部署地址,如 https://studio.example.com
#   STUDIO_API_KEY   Agent API 密钥
set -euo pipefail

if [[ -z "${STUDIO_BASE_URL:-}" || -z "${STUDIO_API_KEY:-}" ]]; then
  echo "error: STUDIO_BASE_URL and STUDIO_API_KEY must be set" >&2
  exit 1
fi

BASE="${STUDIO_BASE_URL%/}"

call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method" "$BASE$path" -H "Authorization: Bearer $STUDIO_API_KEY")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  curl "${args[@]}"
  echo
}

usage() {
  cat <<'EOF'
用法: studio.sh <command> [args]

项目
  list-projects                         项目列表
  create-project '<json>'               创建项目 {name*, clientName, agentName, description, coverUrl}
  get-project <projectId>               项目全量数据(含各阶段交付物与版本)
  update-project <projectId> '<json>'   更新信息 {name, description, coverUrl, ...}
  set-stage <projectId> <STAGE>         推进阶段 SCRIPT|ASSETS|STORYBOARD|FILM|RELEASE|DONE

交付物(版本号自动递增)
  push-script <projectId> '<json>'      推送剧本 {content*, title, logline, changeLog}
  add-asset <projectId> '<json>'        创建资产 {type*: CHARACTER|SCENE|PROP, name*, description, imageUrl, notes}
  asset-version <assetId> '<json>'      资产新版设定图 {imageUrl*, notes}
  add-shot <projectId> '<json>'         创建分镜 {order*, title, duration, dialogue, action, mediaUrl, mediaType, assetIds}
  update-shot <shotId> '<json>'         更新分镜文字/资产引用
  shot-version <shotId> '<json>'        分镜新版画面 {mediaUrl*, mediaType: IMAGE|VIDEO, notes}
  push-film <projectId> '<json>'        推送成片 {videoUrl*, duration, notes}

发行与作品
  add-release <projectId> '<json>'      新增发行记录 {platform*, url, status, notes}
  update-release <releaseId> '<json>'   更新发行状态 {status: PENDING|PUBLISHED, url, publishedAt}
                                        置为 PUBLISHED 时自动把最新成片发布为平台作品
  publish-work '<json>'                 直接发布作品 {kind*: VIDEO|SERIES, title*, category, videoUrl,
                                        coverUrl, description, authorName, episodes: [{order, title, videoUrl, duration}]}
EOF
}

cmd="${1:-}"
case "$cmd" in
  list-projects)   call GET "/api/agent/projects" ;;
  create-project)  call POST "/api/agent/projects" "$2" ;;
  get-project)     call GET "/api/agent/projects/$2" ;;
  update-project)  call PATCH "/api/agent/projects/$2" "$3" ;;
  set-stage)       call PATCH "/api/agent/projects/$2" "{\"currentStage\":\"$3\"}" ;;
  push-script)     call POST "/api/agent/projects/$2/script-versions" "$3" ;;
  add-asset)       call POST "/api/agent/projects/$2/assets" "$3" ;;
  asset-version)   call POST "/api/agent/assets/$2/versions" "$3" ;;
  add-shot)        call POST "/api/agent/projects/$2/shots" "$3" ;;
  update-shot)     call PATCH "/api/agent/shots/$2" "$3" ;;
  shot-version)    call POST "/api/agent/shots/$2/versions" "$3" ;;
  push-film)       call POST "/api/agent/projects/$2/film-versions" "$3" ;;
  add-release)     call POST "/api/agent/projects/$2/releases" "$3" ;;
  update-release)  call PATCH "/api/agent/releases/$2" "$3" ;;
  publish-work)    call POST "/api/agent/works" "$2" ;;
  ""|-h|--help|help) usage ;;
  *) echo "error: unknown command '$cmd'" >&2; usage >&2; exit 1 ;;
esac
