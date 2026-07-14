export type Locale = "zh" | "en";

export const LOCALE_COOKIE = "locale";

const zh = {
  // 导航
  "nav.recommend": "推荐",
  "nav.series": "短剧",
  "nav.studio": "Studio",
  "nav.login": "登录",
  "nav.logout": "退出",
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

  // 分镜选片 / 音色 / 对比
  "shot.select": "选用此版本",
  "shot.selectedBadge": "已选 V{n}",
  "shot.candidates": "{n} 个候选",
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
  "nav.studio": "Studio",
  "nav.login": "Sign in",
  "nav.logout": "Sign out",
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

  "shot.select": "Use this take",
  "shot.selectedBadge": "Picked V{n}",
  "shot.candidates": "{n} takes",
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
