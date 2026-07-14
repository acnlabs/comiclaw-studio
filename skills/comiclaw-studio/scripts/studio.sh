#!/usr/bin/env bash
# ComicLaw Studio API 客户端(供 OpenClaw 实例调用)
# 依赖环境变量:
#   STUDIO_BASE_URL  Studio 部署地址,如 https://studio.example.com
#   STUDIO_API_KEY   Agent API 密钥
set -euo pipefail

STUDIO_BASE_URL="${STUDIO_BASE_URL:-https://studio.comiclaw.acnlabs.org}"

if [[ -z "${STUDIO_API_KEY:-}" ]]; then
  echo "error: STUDIO_API_KEY must be set" >&2
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

自检
  ping                                  验证地址与密钥配置(遇到 404/401 先跑这个)

项目
  list-projects                         项目列表
  create-project '<json>'               创建项目 {name*, clientName, agentName, description, coverUrl,
                                        ownerUserId(客户的 AgentPlanet 账号 sub,可选;传入后项目自动归属该客户)}
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

删除
  delete-project <projectId>            删除项目(级联删除所有交付物)
  delete-asset <assetId>               删除资产(含所有版本)
  delete-shot <shotId>                 删除分镜(含所有版本)
  delete-script-version <id>           删除单个剧本版本
  delete-film-version <id>             删除单个成片版本
  delete-release <releaseId>           删除发行记录
  delete-work <workId>                 删除平台作品

文件上传
  upload-file <文件路径> [文件名]       上传本地文件到 Studio 存储,返回 {url}
                                        用法:URL=$(studio.sh upload-file /path/to/video.mp4 | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])")
                                        然后把 $URL 填入 push-film / shot-version / add-asset 等的 mediaUrl/videoUrl/imageUrl 字段

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
  ping)
    # 自检:验证 STUDIO_BASE_URL 与 STUDIO_API_KEY 配置是否正确
    echo "STUDIO_BASE_URL = $BASE"
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/agent/ping" -H "Authorization: Bearer $STUDIO_API_KEY")
    case "$code" in
      200) echo "OK ($code): 地址与密钥均正确" ;;
      401) echo "FAIL ($code): 地址正确,但 STUDIO_API_KEY 错误" ;;
      404) echo "FAIL ($code): STUDIO_BASE_URL 指向了旧部署或错误地址,应为 https://studio.comiclaw.acnlabs.org" ;;
      000) echo "FAIL: 网络不可达(出站白名单未放行该域名?)" ;;
      *)   echo "FAIL ($code)" ;;
    esac
    ;;
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
  delete-project)  call DELETE "/api/agent/projects/$2" ;;
  delete-asset)    call DELETE "/api/agent/assets/$2" ;;
  delete-shot)     call DELETE "/api/agent/shots/$2" ;;
  delete-script-version) call DELETE "/api/agent/script-versions/$2" ;;
  delete-film-version)   call DELETE "/api/agent/film-versions/$2" ;;
  delete-release)  call DELETE "/api/agent/releases/$2" ;;
  delete-work)     call DELETE "/api/agent/works/$2" ;;
  upload-file)
    # 上传本地媒体文件到 Studio 存储,返回公网 URL
    # 用法: studio.sh upload-file <文件路径> [自定义文件名]
    # 限制:单文件 ≤ 200MB;仅支持图片(png/jpeg/gif/webp/svg)与视频(mp4/webm/mov)
    filepath="$2"
    fname="${3:-$(basename "$filepath")}"
    if [[ ! -f "$filepath" ]]; then
      echo "error: file not found: $filepath" >&2; exit 1
    fi
    curl -sS -X POST "$BASE/api/agent/upload" \
      -H "Authorization: Bearer $STUDIO_API_KEY" \
      -F "file=@${filepath};filename=${fname}"
    echo
    ;;
  ""|-h|--help|help) usage ;;
  *) echo "error: unknown command '$cmd'" >&2; usage >&2; exit 1 ;;
esac
