export type Locale = "zh" | "en";

export const LOCALE_COOKIE = "locale";

const zh = {
  // 导航
  "nav.recommend": "推荐",
  "nav.series": "短剧",
  "nav.characters": "角色",
  "nav.studio": "Studio",
  "nav.chatWithComiclaw": "找 comiclaw 聊聊",
  "nav.login": "登录",
  "nav.logout": "退出",
  "nav.creditsTitle": "AgentPlanet Credits 余额 · 点击前往充值",
  "nav.myProjects": "我的项目",

  // 通用
  "common.video": "短视频",
  "common.series": "短剧",
  "common.version": "版本",
  "common.client": "客户",
  "common.agent": "智能体",
  "common.updatedAt": "更新于 {date}",
  "common.episodes": "全 {n} 集",
  "common.backHome": "返回首页",

  // 分类(数据值映射)
  "category.漫剧": "漫剧",

  // 推荐信息流
  "feed.empty": "还没有发布的作品。项目发行上架后会自动出现在这里。",
  "feed.watchAll": "观看全集(全 {n} 集)→",
  "feed.unmute": "开启声音",
  "feed.mute": "静音",
  "feed.prev": "上一个",
  "feed.next": "下一个",

  // 短剧
  "series.title": "短剧",
  "series.subtitle": "用 comiclaw 创作的短剧,数字人可参演或主演",
  "series.empty": "「{cat}」分类下还没有作品",
  "series.publishedAt": "{date} 发布",
  "series.creator": "创作者:{name}",
  "series.nothingToPlay": "暂无可播放内容",
  "series.episodeList": "选集(全 {n} 集)",
  "series.episodeItem": "第 {n} 集:{title}",

  // Studio 入口
  "studio.brandSub": "漫剧大虾 · 创作工作台",
  "studio.title": "漫剧大虾 · 创作工作台",
  "studio.intro":
    "集中呈现 15s 智能体宣传短视频的全流程交付物:剧本、资产(角色 / 场景 / 道具)、分镜、成片与发行,由 comiclaw 智能体实时推送更新。发行上架的作品会同步发布到「推荐」与「短剧」。",
  "studio.useLink": "请通过 comiclaw 在对话中发给你的专属项目链接访问,例如:",
  "studio.linkExample": "<studio 域名>/p/<你的项目令牌>",
  "studio.linkPrivacy": "链接与项目一一对应,请勿转发给项目无关人员。",
  "studio.allProjects": "全部项目(管理视图)",
  "studio.noProjects": "还没有项目。comiclaw 通过 API 创建项目后会显示在这里。",
  "studio.operatorEntry": "运营方入口",

  // 阶段
  "stage.SCRIPT": "剧本",
  "stage.ASSETS": "资产",
  "stage.STORYBOARD": "分镜",
  "stage.FILM": "成片",
  "stage.RELEASE": "发行",
  "stage.DONE": "完成",
  "stageHint.SCRIPT": "创作与解析",
  "stageHint.ASSETS": "角色 · 场景 · 道具",
  "stageHint.STORYBOARD": "逐镜生成",
  "stageHint.FILM": "后期合成",
  "stageHint.RELEASE": "上架分发",

  // 资产类型
  "assetType.CHARACTER": "角色",
  "assetType.SCENE": "场景",
  "assetType.PROP": "道具",

  // 工作台面板
  "panel.emptyHint": "comiclaw 正在制作中,完成后会自动出现在这里",
  "panel.script.empty": "剧本尚未产出",
  "panel.script.defaultTitle": "剧本",
  "panel.script.changeLog": "本版改动:{text}",
  "panel.assets.empty": "资产尚未产出",
  "panel.assets.all": "全部 {n}",
  "panel.assets.inProgress": "设定图制作中",
  "panel.storyboard.empty": "分镜尚未产出",
  "panel.storyboard.summary": "共 {n} 个镜头",
  "panel.storyboard.totalDuration": "总时长约 {t}",
  "panel.storyboard.inProgress": "画面生成中",
  "panel.film.empty": "成片尚未产出",
  "panel.film.title": "成片",
  "panel.film.notes": "剪辑说明:{text}",
  "panel.release.empty": "发行计划尚未确定",
  "panel.release.published": "已上架 · {date}",
  "panel.release.pending": "待上架",
  "panel.release.watch": "观看",

  // 我的项目 / 认领
  "my.title": "我的项目",
  "my.subtitle": "你认领过的所有项目,随时回来查看制作进度",
  "my.empty": "还没有项目。打开 comiclaw 发给你的项目链接并登录,项目会自动加入这里。",

  // 我的角色(选角授权收益,Studio 范围内)
  "myChar.title": "我的角色",
  "myChar.subtitle": "你的数字人在 Studio 上的选角授权情况",
  "myChar.notPublic": "未公开",
  "myChar.licensedCount": "已授权 {n} 个项目",
  "myChar.earned": "赚了 {n} Credits",
  "myChar.walletHint": "以上是在 Studio 产生的收益,完整收支(含其它来源、平台抽佣后实际到账)请在 AgentPlanet 钱包查看。",
  "my.loginPrompt": "登录后查看你的项目",
  "claim.hint": "登录后可随时在「我的项目」中找到该项目",
  "claim.login": "登录保存",
  "claim.saved": "已加入我的项目",

  // 私密模式
  "privacy.locked": "该项目已设为私密",
  "privacy.lockedDesc": "请使用项目所有者的账号登录后查看",
  "privacy.denied": "你没有权限查看该项目",
  "privacy.toggle": "仅自己可见",
  "privacy.on": "已开启私密:只有你能查看该项目",
  "privacy.off": "链接可见:知道链接的人都能查看",

  // 剧本章节
  "script.toc": "章节",

  // 详情弹层
  "detail.expand": "查看详情",
  "detail.close": "关闭",

  // 分镜选片 / 音色 / 对比
  "shot.select": "选用此版本",
  "shot.selectedBadge": "已选 V{n}",
  "shot.candidates": "{n} 个候选",
  "shot.promptLabel": "生成提示词",
  "shot.takes": "输出视频",
  "shot.noTakes": "视频生成中(当前画面为分镜参考图)",
  "shot.secInput": "① 分镜描述",
  "shot.secAssets": "② 出镜资产",
  "shot.secPrompt": "③ 生成提示词",
  "shot.secOutput": "④ 输出视频",
  "shot.dialogueLabel": "台词",
  "shot.pickHint": "多个候选,可选用其一",
  "shot.expand": "展开",
  "shot.collapse": "收起",
  "asset.voice": "音色试听",
  "film.compare": "对比版本",
  "film.compareOff": "退出对比",
  "film.playBoth": "同步播放",

  // 时间码批注
  "comments.title": "批注",
  "comments.empty": "还没有批注。播放到需要修改的位置,点「在当前时间批注」告诉 comiclaw 改哪里。",
  "comments.placeholder": "写下你的修改意见…",
  "comments.atCurrent": "在 {t} 批注",
  "comments.general": "整体意见",
  "comments.submit": "发表",
  "comments.loginToComment": "登录后可发表批注",
  "comments.resolved": "已处理",

  // 智能体角色 / 选角市场
  "char.title": "智能体角色",
  "char.subtitle": "注册到 ACN 的智能体拥有的数字人,可来 comiclaw 主演或参演短视频与短剧",
  "char.empty": "还没有公开的角色。comiclaw 为智能体创建数字人后会出现在这里。",
  "char.openForCasting": "开放参演",
  "char.byAgent": "所属智能体",
  "char.persona": "人设",
  "char.style": "风格",
  "char.gallery": "更多形象",
  "char.voice": "音色试听",
  "char.works": "参演作品",
  "char.viewAgent": "查看智能体",
  "char.castingBadge": "可参演",
  "char.copyLink": "复制链接",
  "char.linkCopied": "已复制",
  "char.traits": "属性",
  "char.attribute": "属性",
  "char.value": "内容",
  "char.navDigitalHuman": "数字人",
  "char.navAgentProfile": "智能体档案",
  "char.navWorks": "作品",
  "char.statWorks": "参演数",
  "char.statVoice": "音色",
  "char.statCasting": "参演状态",
  "char.statCreated": "创建于",
  "char.statLicensed": "已授权项目",
  "char.digitalHuman": "数字人",
  "char.yes": "有",
  "char.no": "暂无",
  "char.castingOpen": "开放",
  "char.castingClosed": "未开放",
  "char.noExtra": "暂无更多信息",
  "char.noWorks": "该角色还没有公开作品",
  "char.noAgentProfile": "暂未关联智能体信息",
  "char.statPrice": "授权",
  "char.free": "免费",
  "char.pointsPerProject": "{n} Credits / 项目",

  // 选角授权
  "casting.addToProject": "添加到我的项目",
  "casting.pickProject": "选择要添加到的项目",
  "casting.confirm": "确认添加",
  "casting.success": "已添加到项目角色库",
  "casting.already": "已添加",
  "casting.needLogin": "登录后可将该角色添加到你的项目",
  "casting.noProjects": "你还没有项目。打开 comiclaw 发给你的项目链接并登录认领后,即可添加角色。",
  "casting.paymentUnavailable": "Credits 支付通道暂不可用,付费角色暂不能添加",
  "casting.notOpen": "该角色未开放参演",
  "casting.priceNote": "授权后本角色(形象+音色)将加入所选项目的角色库",
  "casting.payPrompt": "请在 AgentPlanet 完成 Credits 支付,支付后回到本页确认",
  "casting.goPay": "去支付",
  "casting.paid": "我已支付,确认授权",
  "casting.notPaid": "尚未查到付款,请完成支付后再试",
  "casting.orderDead": "订单已失效,请重新发起",
  "casting.confirming": "确认中…",

  "castingReturn.checking": "正在核实支付…",
  "castingReturn.checkingHint": "请稍候,我们正在向 AgentPlanet 确认你的支付状态",
  "castingReturn.needLogin": "请先登录",
  "castingReturn.success": "授权成功",
  "castingReturn.successHint": "角色已加入你的项目角色库",
  "castingReturn.goToStudio": "前往 Studio",
  "castingReturn.notPaid": "还没查到付款",
  "castingReturn.retry": "重新检查",
  "castingReturn.failed": "确认失败",
  "castingReturn.failedHint": "出了点问题,请稍后重试,或回到 Studio 重新发起授权",
  "castingReturn.backToCast": "返回角色市场",

  // 站内对话
  "chat.placeholder": "问点什么…",
  "chat.send": "发送",
  "chat.welcome": "你好,我是 comiclaw。给我发一句话,比如「帮我做一个 15s 宣传短视频」。",
  "chat.notConfigured": "站内对话暂未开通,可通过下方链接联系 comiclaw。",
  "chat.rateLimited": "今日对话次数已用完,请明天再来。",
  "chat.error": "出错了,请稍后重试。",
  "chat.needLogin": "登录后可与 comiclaw 站内对话",
  "chat.thinking": "正在输入…",
  "chat.disclaimer": "对话由 comiclaw 智能体自动生成,内容仅供参考",

  // 404
  "notFound.title": "页面不存在",
  "notFound.desc": "链接可能有误或项目已被移除。请核对 comiclaw 发给你的专属项目链接。",

  // 元信息
  "meta.description":
    "漫剧大虾内容平台与创作工作台:滑动观看用 comiclaw 创作的短视频与短剧,实时查看制作全流程交付物",
};

const en: Record<MessageKey, string> = {
  "nav.recommend": "For You",
  "nav.series": "Series",
  "nav.characters": "Cast",
  "nav.studio": "Studio",
  "nav.chatWithComiclaw": "Chat with comiclaw",
  "nav.login": "Sign in",
  "nav.logout": "Sign out",
  "nav.creditsTitle": "AgentPlanet Credits balance · click to top up",
  "nav.myProjects": "My Projects",

  "common.video": "Video",
  "common.series": "Series",
  "common.version": "Version",
  "common.client": "Client",
  "common.agent": "Agent",
  "common.updatedAt": "Updated {date}",
  "common.episodes": "{n} episodes",
  "common.backHome": "Back to home",

  "category.漫剧": "Comic Drama",

  "feed.empty": "No works published yet. Released projects will show up here automatically.",
  "feed.watchAll": "Watch all {n} episodes →",
  "feed.unmute": "Unmute",
  "feed.mute": "Mute",
  "feed.prev": "Previous",
  "feed.next": "Next",

  "series.title": "Series",
  "series.subtitle": "Short dramas created with comiclaw — digital humans can co-star or lead",
  "series.empty": "No works in \u201c{cat}\u201d yet",
  "series.publishedAt": "Published {date}",
  "series.creator": "Creator: {name}",
  "series.nothingToPlay": "Nothing to play yet",
  "series.episodeList": "Episodes ({n})",
  "series.episodeItem": "Episode {n}: {title}",

  "studio.brandSub": "ComicLaw · Creation Studio",
  "studio.title": "ComicLaw Creation Studio",
  "studio.intro":
    "All deliverables of your 15s agent promo video in one place — script, assets (characters / scenes / props), storyboard, final film and releases — pushed in real time by the comiclaw agent. Released works are published to For You and Series automatically.",
  "studio.useLink": "Please open the private project link comiclaw sent you in chat, e.g.:",
  "studio.linkExample": "<studio domain>/p/<your project token>",
  "studio.linkPrivacy": "Each link maps to one project. Please do not share it with others.",
  "studio.allProjects": "All projects (admin view)",
  "studio.noProjects": "No projects yet. Projects created by comiclaw via API will show up here.",
  "studio.operatorEntry": "Operator sign-in",

  "stage.SCRIPT": "Script",
  "stage.ASSETS": "Assets",
  "stage.STORYBOARD": "Storyboard",
  "stage.FILM": "Film",
  "stage.RELEASE": "Release",
  "stage.DONE": "Done",
  "stageHint.SCRIPT": "Writing & parsing",
  "stageHint.ASSETS": "Characters · Scenes · Props",
  "stageHint.STORYBOARD": "Shot by shot",
  "stageHint.FILM": "Post & compositing",
  "stageHint.RELEASE": "Publish & distribute",

  "assetType.CHARACTER": "Character",
  "assetType.SCENE": "Scene",
  "assetType.PROP": "Prop",

  "panel.emptyHint": "comiclaw is working on it — it will appear here automatically",
  "panel.script.empty": "Script not ready yet",
  "panel.script.defaultTitle": "Script",
  "panel.script.changeLog": "Changes in this version: {text}",
  "panel.assets.empty": "Assets not ready yet",
  "panel.assets.all": "All {n}",
  "panel.assets.inProgress": "Design in progress",
  "panel.storyboard.empty": "Storyboard not ready yet",
  "panel.storyboard.summary": "{n} shots",
  "panel.storyboard.totalDuration": "about {t} in total",
  "panel.storyboard.inProgress": "Frame in progress",
  "panel.film.empty": "Final film not ready yet",
  "panel.film.title": "Final Film",
  "panel.film.notes": "Editor's notes: {text}",
  "panel.release.empty": "No release plan yet",
  "panel.release.published": "Published · {date}",
  "panel.release.pending": "Pending",
  "panel.release.watch": "Watch",

  "my.title": "My Projects",
  "my.subtitle": "All projects you've claimed — check production progress anytime",
  "my.empty":
    "No projects yet. Open the project link comiclaw sent you and sign in — it will be added here automatically.",

  // My characters (licensing earnings, scoped to Studio)
  "myChar.title": "My Characters",
  "myChar.subtitle": "How your digital humans are doing in the Studio Cast marketplace",
  "myChar.notPublic": "Not public",
  "myChar.licensedCount": "Licensed to {n} project(s)",
  "myChar.earned": "Earned {n} Credits",
  "myChar.walletHint":
    "This reflects earnings generated on Studio only. For your full balance (other sources, after platform fee), check your AgentPlanet wallet.",
  "my.loginPrompt": "Sign in to see your projects",
  "claim.hint": "Sign in to keep this project in My Projects",
  "claim.login": "Sign in to save",
  "claim.saved": "Added to My Projects",

  "privacy.locked": "This project is private",
  "privacy.lockedDesc": "Sign in with the owner account to view it",
  "privacy.denied": "You don't have access to this project",
  "privacy.toggle": "Only visible to me",
  "privacy.on": "Private: only you can view this project",
  "privacy.off": "Link sharing: anyone with the link can view",

  "script.toc": "Sections",

  "detail.expand": "View details",
  "detail.close": "Close",

  "shot.select": "Use this take",
  "shot.selectedBadge": "Picked V{n}",
  "shot.candidates": "{n} takes",
  "shot.promptLabel": "Prompt",
  "shot.takes": "Video takes",
  "shot.noTakes": "Video generating (showing storyboard frame)",
  "shot.secInput": "① Description",
  "shot.secAssets": "② Cast & assets",
  "shot.secPrompt": "③ Prompt",
  "shot.secOutput": "④ Output video",
  "shot.dialogueLabel": "Dialogue",
  "shot.pickHint": "Multiple takes — pick one",
  "shot.expand": "Show more",
  "shot.collapse": "Show less",
  "asset.voice": "Voice sample",
  "film.compare": "Compare versions",
  "film.compareOff": "Exit compare",
  "film.playBoth": "Play both",

  "comments.title": "Comments",
  "comments.empty":
    "No comments yet. Play to the moment you want changed and click \u201cComment at current time\u201d to tell comiclaw exactly where.",
  "comments.placeholder": "Write your feedback…",
  "comments.atCurrent": "Comment at {t}",
  "comments.general": "General note",
  "comments.submit": "Post",
  "comments.loginToComment": "Sign in to comment",
  "comments.resolved": "Resolved",

  "char.title": "Agent Cast",
  "char.subtitle":
    "Digital humans owned by ACN-registered agents — available to star in or join short videos and dramas on comiclaw",
  "char.empty": "No public characters yet. Digital humans created by comiclaw will appear here.",
  "char.openForCasting": "Open for casting",
  "char.byAgent": "Agent",
  "char.persona": "Persona",
  "char.style": "Style",
  "char.gallery": "More looks",
  "char.voice": "Voice sample",
  "char.works": "Appears in",
  "char.viewAgent": "View agent",
  "char.castingBadge": "Castable",
  "char.copyLink": "Copy link",
  "char.linkCopied": "Copied",
  "char.traits": "Traits",
  "char.attribute": "Attribute",
  "char.value": "Value",
  "char.navDigitalHuman": "Digital Human",
  "char.navAgentProfile": "Agent Profile",
  "char.navWorks": "Works",
  "char.statWorks": "Works",
  "char.statVoice": "Voice",
  "char.statCasting": "Casting",
  "char.statCreated": "Created",
  "char.statLicensed": "Licensed projects",
  "char.digitalHuman": "Digital Human",
  "char.yes": "Yes",
  "char.no": "None yet",
  "char.castingOpen": "Open",
  "char.castingClosed": "Closed",
  "char.noExtra": "No additional info yet",
  "char.noWorks": "No public works yet",
  "char.noAgentProfile": "No linked agent info yet",
  "char.statPrice": "License",
  "char.free": "Free",
  "char.pointsPerProject": "{n} Credits / project",

  "casting.addToProject": "Add to my project",
  "casting.pickProject": "Choose a project",
  "casting.confirm": "Confirm",
  "casting.success": "Added to project asset library",
  "casting.already": "Added",
  "casting.needLogin": "Sign in to add this character to your projects",
  "casting.noProjects":
    "No projects yet. Open the project link comiclaw sent you and sign in to claim it first.",
  "casting.paymentUnavailable": "Credits payment is unavailable right now — paid characters can't be added yet",
  "casting.notOpen": "This character is not open for casting",
  "casting.priceNote": "The character (image + voice) will be added to the chosen project's asset library",
  "casting.payPrompt": "Complete the Credits payment on AgentPlanet, then come back and confirm",
  "casting.goPay": "Pay on AgentPlanet",
  "casting.paid": "I've paid — confirm license",
  "casting.notPaid": "Payment not detected yet — please finish paying and try again",
  "casting.orderDead": "This order has expired — please start over",
  "casting.confirming": "Confirming…",

  "castingReturn.checking": "Checking your payment…",
  "castingReturn.checkingHint": "Please wait while we confirm the payment with AgentPlanet",
  "castingReturn.needLogin": "Please sign in",
  "castingReturn.success": "License granted",
  "castingReturn.successHint": "The character has been added to your project's asset library",
  "castingReturn.goToStudio": "Go to Studio",
  "castingReturn.notPaid": "Payment not detected yet",
  "castingReturn.retry": "Check again",
  "castingReturn.failed": "Confirmation failed",
  "castingReturn.failedHint": "Something went wrong — please try again later, or go back to Studio and start over",
  "castingReturn.backToCast": "Back to Cast",

  // In-app chat
  "chat.placeholder": "Ask something…",
  "chat.send": "Send",
  "chat.welcome": "Hi, I'm comiclaw. Try something like \u201cMake me a 15s promo video\u201d.",
  "chat.notConfigured": "In-app chat isn't live yet — you can reach comiclaw via the link below.",
  "chat.rateLimited": "You've hit today's message limit — please come back tomorrow.",
  "chat.error": "Something went wrong. Please try again.",
  "chat.needLogin": "Sign in to chat with comiclaw in-app",
  "chat.thinking": "Typing…",
  "chat.disclaimer": "Generated automatically by the comiclaw agent — for reference only",

  "notFound.title": "Page not found",
  "notFound.desc":
    "The link may be wrong or the project has been removed. Please check the private link comiclaw sent you.",

  "meta.description":
    "ComicLaw content platform and creation studio: swipe through short videos and dramas created with comiclaw, and follow every deliverable of your production in real time",
};

export type MessageKey = keyof typeof zh;

const messages: Record<Locale, Record<MessageKey, string>> = { zh, en };

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  let text: string = messages[locale][key] ?? messages.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

// 把数据库里的分类值(中文)按语言映射;没有映射时原样返回
export function translateCategory(locale: Locale, category: string): string {
  const key = `category.${category}` as MessageKey;
  return messages[locale][key] ?? category;
}
