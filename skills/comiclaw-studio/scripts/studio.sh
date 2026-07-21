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

按用量扣款(生产成本,向项目所有者的 AgentPlanet 钱包按次扣 Credits)
  charge <projectId> '<json>'           调用即梦/Seedance 等上游生成前先扣款
                                        {amount*(Credits,整数>0), action*(script_gen|asset_generate|
                                        shot_generate|video_generate|post_production), reason*(如
                                        "video_gen:seedance:15s"), idempotencyKey*(建议
                                        "comiclaw:gen:<jobId>",同一次生成动作重试不会重复扣款),
                                        provider(如 seedance/jimeng), metadata(任意附加信息)}
                                        返回 402 = 余额不足,此时**不得**继续调用上游生成,应停下
                                        并通过 set-status 告知客户"余额不足,请充值后继续";
                                        网络失败/5xx 用**同一个** idempotencyKey 重试,不要换新 key
  get-charges <projectId>               查询这个项目已发起过的扣款记录(排障用;权威金额/余额
                                        以 AgentPlanet 为准,这里不是账本也不做汇总)
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
  set-status)
    # 更新实时状态条(客户页面顶部实时显示);传空字符串清除
    note="${3:-}"
    call PATCH "/api/agent/projects/$2" "{\"statusNote\":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$note")}"
    ;;
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
  create-character) call POST "/api/agent/characters" "$2" ;;
  set-work-cast)    call POST "/api/agent/works/$2/cast" "$3" ;;
  list-characters)  call GET "/api/agent/characters" ;;
  update-character) call PATCH "/api/agent/characters/$2" "$3" ;;
  character-listing) call GET "/api/agent/characters/$2/listing" ;;
  delete-character) call DELETE "/api/agent/characters/$2" ;;
  list-comments)   call GET "/api/agent/projects/$2/comments${3:+?status=$3}" ;;
  resolve-comment) call PATCH "/api/agent/comments/$2" '{"status":"RESOLVED"}' ;;
  delete-project)  call DELETE "/api/agent/projects/$2" ;;
  delete-asset)    call DELETE "/api/agent/assets/$2" ;;
  delete-shot)     call DELETE "/api/agent/shots/$2" ;;
  delete-script-version) call DELETE "/api/agent/script-versions/$2" ;;
  delete-film-version)   call DELETE "/api/agent/film-versions/$2" ;;
  delete-release)  call DELETE "/api/agent/releases/$2" ;;
  delete-work)     call DELETE "/api/agent/works/$2" ;;
  charge)          call POST "/api/agent/projects/$2/charge" "$3" ;;
  get-charges)     call GET "/api/agent/projects/$2/charge" ;;
  upload-file)
    # 上传本地媒体文件到 Studio 存储,返回公网 URL
    # 用法: studio.sh upload-file <文件路径> [自定义文件名]
    # 限制:单文件 ≤ 200MB;支持图片(png/jpeg/gif/webp/svg)、视频(mp4/webm/mov)、音频(mp3/wav/ogg/aac/m4a)
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
