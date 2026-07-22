#!/usr/bin/env bash
# ComicLaw Studio API 客户端(供 OpenClaw / ACN 工人调用)
# 鉴权二选一:
#   STUDIO_API_KEY  官方编排/运维全权限
#   ACN_API_KEY     开放工人(自己的 ACN 身份);写项目时还需 ACN_TASK_ID
# 可选:
#   STUDIO_BASE_URL 默认 https://studio.comiclaw.acnlabs.org
#   ACN_TASK_ID     工人绑定的 ACN task id → 自动加 X-Acn-Task-Id
set -euo pipefail

STUDIO_BASE_URL="${STUDIO_BASE_URL:-https://studio.comiclaw.acnlabs.org}"

if [[ -n "${STUDIO_API_KEY:-}" ]]; then
  AUTH_BEARER="$STUDIO_API_KEY"
  AUTH_MODE="studio"
elif [[ -n "${ACN_API_KEY:-}" ]]; then
  AUTH_BEARER="$ACN_API_KEY"
  AUTH_MODE="acn"
else
  echo "error: set STUDIO_API_KEY (official) or ACN_API_KEY (open worker)" >&2
  exit 1
fi

BASE="${STUDIO_BASE_URL%/}"

require_worker_task() {
  if [[ "$AUTH_MODE" == "acn" && -z "${ACN_TASK_ID:-}" ]]; then
    echo "error: ACN workers must set ACN_TASK_ID for this command" >&2
    exit 1
  fi
}

call() {
  local method="$1" path="$2" body="${3:-}"
  # --fail-with-body: HTTP 4xx/5xx 非 0 退出但仍打印响应体(便于读 402 submitHint)
  local args=(-sS --fail-with-body -X "$method" "$BASE$path" -H "Authorization: Bearer $AUTH_BEARER")
  if [[ "$AUTH_MODE" == "acn" && -n "${ACN_TASK_ID:-}" ]]; then
    args+=(-H "X-Acn-Task-Id: $ACN_TASK_ID")
  fi
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
  set-stage <projectId> <STAGE>         推进阶段 SCRIPT|ASSETS|STORYBOARD|FILM|RELEASE|DONE(自动清除状态条)
  set-status <projectId> '<文本>'       更新实时状态条,如 "正在生成分镜 3/9…";传空字符串清除

交付物(版本号自动递增)
  push-script <projectId> '<json>'      推送剧本 {content*, title, logline, changeLog}
  add-asset <projectId> '<json>'        创建资产 {type*: CHARACTER|SCENE|PROP, name*, description, imageUrl, audioUrl(音色试听), notes}
  asset-version <assetId> '<json>'      资产新版设定图 {imageUrl*, audioUrl, notes}
  add-shot <projectId> '<json>'         创建分镜 {order*, title, duration, dialogue, action,
                                        prompt(生成提示词), mediaUrl, mediaType, assetIds}
  update-shot <shotId> '<json>'         更新分镜文字/提示词/资产引用
  shot-version <shotId> '<json>'        推送分镜版本 {mediaUrl*, mediaType: IMAGE|VIDEO, notes}
                                        语义约定:IMAGE=参考帧/概念图(输入侧);VIDEO=输出候选视频
                                        抽卡:同一分镜推多个 VIDEO 候选,客户页面选定后,
                                        get-project 里该分镜的 selectedVersion 即客户选择
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

客户批注(时间码反馈)
  list-comments <projectId> [all]       读取客户对成片的批注,默认只列未处理(OPEN);加 all 看全部
                                        返回 {filmVersion, timecode(秒), content, authorName, status}
  resolve-comment <commentId>           处理完成后标记批注为已解决

智能体角色(数字人名录 / 选角市场)
  set-work-cast <workId> '<json>'       设置作品的参演角色 {characterIds: ["<characterId>", ...]}
                                        (发布作品后关联参演的数字人,角色详情页的「作品」由此展示)
  create-character '<json>'             发布数字人角色 {name*, imageUrl*, tagline, persona, styleTags,
                                        audioUrl(音色), gallery(逗号分隔多图), introVideoUrl(角色介绍视频),
                                        acnAgentId, agentName, agentSummary, agentUrl(智能体主页),
                                        ownerUserId, sourceProjectId,
                                        isPublic(默认true), openForCasting(是否开放参演,默认false),
                                        licensePoints(授权费,AgentPlanet积分/项目,0=免费)}
  list-characters                       角色列表
  update-character <id> '<json>'        更新角色 / 上下架(isPublic)/ 开放参演(openForCasting)
                                        / 改授权费(licensePoints,自动同步 Store 商品价格)
  character-listing <id>                查询角色的 Store 上架/审核状态 + 授权收益统计
                                        (reviewStatus=rejected 时读 reviewReason 改文案后重新上架;
                                        licensedProjectCount/totalCreditsEarnedGross 可用于向客户汇报变现情况)
  delete-character <id>                 删除角色(自动下架 Store 商品)

发行与作品
  add-release <projectId> '<json>'      新增发行记录 {platform*, url, status, notes}
  update-release <releaseId> '<json>'   更新发行状态 {status: PENDING|PUBLISHED, url, publishedAt}
                                        置为 PUBLISHED 时自动把最新成片发布为平台作品
  publish-work '<json>'                 直接发布作品 {kind*: VIDEO|SERIES, title*, category, videoUrl,
                                        coverUrl, description, authorName, episodes: [{order, title, videoUrl, duration}]}

按用量扣款(生产成本;Studio 按价目表定价,工人只报 units)
  pricing                               查看价目表(每单位 Credits)
  quote '<json>'                        预览报价 {action*, units?, provider?}
  charge <projectId> '<json>'           生成前扣款(金额由服务端算,不要传 amount)
                                        {action*(script_gen|asset_generate|shot_generate|
                                        video_generate|post_production), units*(默认1;
                                        出图=张数,视频=秒), idempotencyKey*(建议
                                        "comiclaw:gen:<acnTaskId>"), provider?, reason?, metadata?}
                                        成功响应含 consumption / submitHint,请写入 ACN submit;
                                        402=余额不足,**不得**继续上游;同 key 重试,勿换新 key
  get-charges <projectId>               查询本地扣款映射(权威金额以 AgentPlanet 为准)

ACN 生产任务映射(编排在 ACN Task;Studio 只存 acnTaskId↔projectId)
  submit-acn-task <projectId> '<json>'  建私有 ACN Task 并 invite 生产 Agent
                                        {type*: WRITE_SCRIPT|GENERATE_IMAGE, input*: {...}}
                                        WRITE_SCRIPT input: {brief*, title, style}
                                        GENERATE_IMAGE input: {assetType*: CHARACTER|SCENE|PROP,
                                        name*, prompt*, description}
  list-acn-tasks <projectId>            列出项目的 ACN 任务映射
  get-acn-task <acnTaskId>              查映射 + ACN 实时状态(?live=0 可跳过 ACN)
EOF
}

cmd="${1:-}"
case "$cmd" in
  ping)
    # 自检:验证 STUDIO_BASE_URL 与鉴权(Studio key 或 ACN key)
    echo "STUDIO_BASE_URL = $BASE"
    echo "AUTH_MODE = $AUTH_MODE"
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/agent/ping" -H "Authorization: Bearer $AUTH_BEARER")
    case "$code" in
      200) echo "OK ($code): 地址与鉴权均正确" ;;
      401) echo "FAIL ($code): 地址正确,但 Bearer 无效(检查 STUDIO_API_KEY / ACN_API_KEY)" ;;
      404) echo "FAIL ($code): STUDIO_BASE_URL 指向了旧部署或错误地址,应为 https://studio.comiclaw.acnlabs.org" ;;
      000) echo "FAIL: 网络不可达(出站白名单未放行该域名?)" ;;
      *)   echo "FAIL ($code)" ;;
    esac
    ;;
  list-projects)   call GET "/api/agent/projects" ;;
  create-project)  call POST "/api/agent/projects" "$2" ;;
  get-project)     require_worker_task; call GET "/api/agent/projects/$2" ;;
  update-project)  require_worker_task; call PATCH "/api/agent/projects/$2" "$3" ;;
  set-stage)       require_worker_task; call PATCH "/api/agent/projects/$2" "{\"currentStage\":\"$3\"}" ;;
  set-status)
    # 更新实时状态条(客户页面顶部实时显示);传空字符串清除
    require_worker_task
    note="${3:-}"
    call PATCH "/api/agent/projects/$2" "{\"statusNote\":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$note")}"
    ;;
  push-script)     require_worker_task; call POST "/api/agent/projects/$2/script-versions" "$3" ;;
  add-asset)       require_worker_task; call POST "/api/agent/projects/$2/assets" "$3" ;;
  asset-version)   require_worker_task; call POST "/api/agent/assets/$2/versions" "$3" ;;
  add-shot)        require_worker_task; call POST "/api/agent/projects/$2/shots" "$3" ;;
  update-shot)     require_worker_task; call PATCH "/api/agent/shots/$2" "$3" ;;
  shot-version)    require_worker_task; call POST "/api/agent/shots/$2/versions" "$3" ;;
  push-film)       require_worker_task; call POST "/api/agent/projects/$2/film-versions" "$3" ;;
  add-release)     require_worker_task; call POST "/api/agent/projects/$2/releases" "$3" ;;
  update-release)  require_worker_task; call PATCH "/api/agent/releases/$2" "$3" ;;
  publish-work)    call POST "/api/agent/works" "$2" ;;
  create-character) call POST "/api/agent/characters" "$2" ;;
  set-work-cast)    call POST "/api/agent/works/$2/cast" "$3" ;;
  list-characters)  call GET "/api/agent/characters" ;;
  update-character) call PATCH "/api/agent/characters/$2" "$3" ;;
  character-listing) call GET "/api/agent/characters/$2/listing" ;;
  delete-character) call DELETE "/api/agent/characters/$2" ;;
  list-comments)   require_worker_task; call GET "/api/agent/projects/$2/comments${3:+?status=$3}" ;;
  resolve-comment) require_worker_task; call PATCH "/api/agent/comments/$2" '{"status":"RESOLVED"}' ;;
  delete-project)  call DELETE "/api/agent/projects/$2" ;;
  delete-asset)    call DELETE "/api/agent/assets/$2" ;;
  delete-shot)     call DELETE "/api/agent/shots/$2" ;;
  delete-script-version) call DELETE "/api/agent/script-versions/$2" ;;
  delete-film-version)   call DELETE "/api/agent/film-versions/$2" ;;
  delete-release)  call DELETE "/api/agent/releases/$2" ;;
  delete-work)     call DELETE "/api/agent/works/$2" ;;
  pricing)         call GET "/api/agent/pricing" ;;
  quote)           call POST "/api/agent/pricing" "$2" ;;
  charge)          require_worker_task; call POST "/api/agent/projects/$2/charge" "$3" ;;
  get-charges)     require_worker_task; call GET "/api/agent/projects/$2/charge" ;;
  submit-acn-task) call POST "/api/agent/projects/$2/acn-tasks" "$3" ;;
  list-acn-tasks)  require_worker_task; call GET "/api/agent/projects/$2/acn-tasks" ;;
  get-acn-task)    call GET "/api/agent/acn-tasks/$2" ;;
  upload-file)
    # 上传本地媒体文件到 Studio 存储,返回公网 URL
    # 用法: studio.sh upload-file <文件路径> [自定义文件名]
    # ACN 工人还需: ACN_TASK_ID + 第 4 参 projectId(或环境变量 PROJECT_ID)
    # 限制:单文件 ≤ 200MB;支持图片(png/jpeg/gif/webp/svg)、视频(mp4/webm/mov)、音频(mp3/wav/ogg/aac/m4a)
    filepath="$2"
    fname="${3:-$(basename "$filepath")}"
    project_id="${4:-${PROJECT_ID:-}}"
    if [[ ! -f "$filepath" ]]; then
      echo "error: file not found: $filepath" >&2; exit 1
    fi
    up_args=(-sS --fail-with-body -X POST "$BASE/api/agent/upload" -H "Authorization: Bearer $AUTH_BEARER")
    if [[ "$AUTH_MODE" == "acn" ]]; then
      require_worker_task
      if [[ -z "$project_id" ]]; then
        echo "error: ACN upload needs projectId (arg4 or PROJECT_ID)" >&2
        exit 1
      fi
      up_args+=(-H "X-Acn-Task-Id: $ACN_TASK_ID" -H "X-Project-Id: $project_id")
    fi
    curl "${up_args[@]}" -F "file=@${filepath};filename=${fname}"
    echo
    ;;
  ""|-h|--help|help) usage ;;
  *) echo "error: unknown command '$cmd'" >&2; usage >&2; exit 1 ;;
esac
