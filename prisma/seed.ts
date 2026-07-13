import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 演示视频(公网可访问的示例素材,仅用于占位)
const DEMO_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";

const SCRIPT_V1 = `# 《漫剧大虾:你的智能体,该出道了》

## 场次 1|深海片场(0-3s)
幽蓝深海,一束光柱打下。悬浮摄影机环绕,"漫剧大虾" LOGO 从气泡中浮现。

> 旁白:每个智能体,都值得一支自己的宣传片。

## 场次 2|大虾队长登场(3-7s)
大虾队长破浪而出,身披导演马甲,手持金色场记板,对镜头敬礼。

> 大虾队长:剧本、分镜、成片——交给我!

## 场次 3|能力展示(7-11s)
场记板一挥,分镜画面如卡牌展开:剧本生成、数字人设定、视频合成一气呵成。

> 旁白:对话即创作,15 秒讲清你的智能体。

## 场次 4|收尾定格(11-15s)
赛博发布厅,全息屏播放客户智能体形象,大虾队长竖起大拇指,口号定格。

> 大虾队长:漫剧大虾,让智能体开机即主角!
`;

const SCRIPT_V2 = `# 《漫剧大虾:你的智能体,该出道了》(修订版)

## 场次 1|深海片场(0-3s)
幽蓝深海,一束光柱打下。悬浮摄影机环绕,"漫剧大虾" LOGO 从气泡中浮现。

> 旁白:每个智能体,都值得一支宣传片。

## 场次 2|大虾队长登场(3-6s)
大虾队长破浪而出,身披导演马甲,手持金色场记板,对镜头敬礼。

> 大虾队长:剧本、分镜、成片,一句话搞定!

## 场次 3|能力展示(6-10s)
场记板一挥,分镜画面如卡牌展开:剧本生成、数字人设定、视频合成一气呵成。

> 旁白:对话即创作,还能让你的数字人主演短剧。

## 场次 4|发布厅高光(10-13s)
赛博发布厅,全息屏播放客户智能体的数字形象,观众席掌声四起。

## 场次 5|收尾定格(13-15s)
大虾队长与客户数字人并肩而立,口号与二维码定格。

> 大虾队长:漫剧大虾,让智能体开机即主角!
`;

async function main() {
  // 幂等:清空重建演示项目
  await prisma.project.deleteMany({ where: { shareToken: "demo" } });

  const project = await prisma.project.create({
    data: {
      shareToken: "demo",
      name: "「漫剧大虾」智能体 15s 宣传短视频",
      clientName: "ACN Labs",
      agentName: "漫剧大虾 ComicLaw",
      description:
        "以大虾队长为主角,面向智能体客户的 15 秒宣传短视频:展示对话式剧创全流程能力,并预告数字人可参演后续短剧。",
      coverUrl: "/demo/cover.svg",
      currentStage: "FILM",
    },
  });

  await prisma.scriptVersion.createMany({
    data: [
      {
        projectId: project.id,
        version: 1,
        title: "你的智能体,该出道了",
        logline: "大虾队长 15 秒讲清:对话即可为智能体产出宣传片。",
        content: SCRIPT_V1,
      },
      {
        projectId: project.id,
        version: 2,
        title: "你的智能体,该出道了",
        logline: "大虾队长 15 秒讲清:对话即可为智能体产出宣传片,数字人还能主演短剧。",
        content: SCRIPT_V2,
        changeLog: "压缩旁白节奏,新增发布厅高光场次,突出数字人参演短剧的卖点。",
      },
    ],
  });

  const daxia = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: "CHARACTER",
      name: "大虾队长",
      description: "漫剧大虾官方数字人:导演马甲 + 金色场记板,热血自信,担任宣传片主讲。",
      versions: {
        create: [
          { version: 1, imageUrl: "/demo/char-daxia-v1.svg", notes: "写实深海风首稿" },
          { version: 2, imageUrl: "/demo/char-daxia-v2.svg", notes: "改为国漫铠甲风,增强记忆点" },
        ],
      },
    },
  });

  const sceneSea = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: "SCENE",
      name: "深海片场",
      description: "开场场景:幽蓝深海中的拍摄基地,光柱与悬浮摄影机营造电影感。",
      versions: { create: [{ version: 1, imageUrl: "/demo/scene-sea.svg" }] },
    },
  });

  const sceneStage = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: "SCENE",
      name: "赛博发布厅",
      description: "收尾场景:霓虹环幕全息舞台,用于展示客户智能体的数字形象。",
      versions: { create: [{ version: 1, imageUrl: "/demo/scene-stage.svg" }] },
    },
  });

  const clapper = await prisma.asset.create({
    data: {
      projectId: project.id,
      type: "PROP",
      name: "金色场记板",
      description: "大虾队长的标志性道具,挥动即触发'开拍',是能力展示的视觉锚点。",
      versions: { create: [{ version: 1, imageUrl: "/demo/prop-clapper.svg" }] },
    },
  });

  const shots: {
    order: number;
    title: string;
    duration: number;
    action: string;
    dialogue?: string;
    assetIds: string[];
    extraVideo?: boolean;
  }[] = [
    {
      order: 1,
      title: "开场:LOGO 浮现",
      duration: 3,
      action: "深海光柱中,LOGO 从气泡中浮现,摄影机环绕推进。",
      dialogue: "每个智能体,都值得一支宣传片。",
      assetIds: [sceneSea.id],
      extraVideo: true,
    },
    {
      order: 2,
      title: "登场:大虾队长",
      duration: 3,
      action: "大虾队长破浪而出,导演马甲 + 场记板,对镜头敬礼。",
      dialogue: "剧本、分镜、成片,一句话搞定!",
      assetIds: [daxia.id, sceneSea.id, clapper.id],
    },
    {
      order: 3,
      title: "能力:分镜卡牌展开",
      duration: 4,
      action: "场记板一挥,剧本生成、数字人设定、视频合成如卡牌依次展开。",
      dialogue: "对话即创作,还能让你的数字人主演短剧。",
      assetIds: [daxia.id, clapper.id],
    },
    {
      order: 4,
      title: "高光:发布厅演示",
      duration: 3,
      action: "赛博发布厅全息屏播放客户智能体形象,观众席掌声四起。",
      assetIds: [sceneStage.id],
    },
    {
      order: 5,
      title: "收尾:口号定格",
      duration: 2,
      action: "大虾队长与客户数字人并肩而立,口号与二维码定格。",
      dialogue: "漫剧大虾,让智能体开机即主角!",
      assetIds: [daxia.id, sceneStage.id],
    },
  ];

  for (const s of shots) {
    await prisma.shot.create({
      data: {
        projectId: project.id,
        order: s.order,
        title: s.title,
        duration: s.duration,
        action: s.action,
        dialogue: s.dialogue ?? null,
        assetRefs: { create: s.assetIds.map((assetId) => ({ assetId })) },
        versions: {
          create: [
            { version: 1, mediaUrl: `/demo/shot-${s.order}.svg`, mediaType: "IMAGE", notes: "分镜概念图" },
            ...(s.extraVideo
              ? [{ version: 2, mediaUrl: DEMO_VIDEO, mediaType: "VIDEO", notes: "Seedance 首版动态镜头" }]
              : []),
          ],
        },
      },
    });
  }

  await prisma.filmVersion.create({
    data: {
      projectId: project.id,
      version: 1,
      videoUrl: DEMO_VIDEO,
      duration: 15,
      notes: "首版粗剪:按 V2 剧本五场次合成,待客户确认后精修调色与配乐。",
    },
  });

  await prisma.release.createMany({
    data: [
      {
        projectId: project.id,
        platform: "抖音",
        status: "PENDING",
        notes: "等待成片定稿后提交审核",
      },
      {
        projectId: project.id,
        platform: "微信视频号",
        status: "PENDING",
        notes: "与抖音同步排期",
      },
    ],
  });

  // ---------- 平台作品(推荐 / 短剧) ----------

  // 仅清理演示 seed 生成的作品,避免误删真实数据
  await prisma.work.deleteMany({
    where: { title: { in: ["「漫剧大虾」智能体 15s 宣传短视频", "智能体出道记", "大虾闯片场"] } },
  });

  // 已发行的宣传片作品(模拟发行上架后同步发布的结果)
  await prisma.work.create({
    data: {
      kind: "VIDEO",
      title: "「漫剧大虾」智能体 15s 宣传短视频",
      description: "大虾队长 15 秒讲清:对话即可为智能体产出宣传片,数字人还能主演短剧。",
      coverUrl: "/demo/work-promo.svg",
      videoUrl: DEMO_VIDEO,
      authorName: "ACN Labs",
      projectId: project.id,
    },
  });

  // 漫剧短剧(演示)
  await prisma.work.create({
    data: {
      kind: "SERIES",
      category: "漫剧",
      title: "智能体出道记",
      description: "一个客服智能体从工具到偶像的出道之路,由客户数字人主演。",
      coverUrl: "/demo/series-agent.svg",
      authorName: "小智科技",
      episodes: {
        create: [
          { order: 1, title: "被用户吐槽的第一天", videoUrl: DEMO_VIDEO, duration: 62 },
          { order: 2, title: "数字形象大改造", videoUrl: DEMO_VIDEO, duration: 58 },
          { order: 3, title: "全网首播", videoUrl: DEMO_VIDEO, duration: 65 },
        ],
      },
    },
  });

  await prisma.work.create({
    data: {
      kind: "SERIES",
      category: "漫剧",
      title: "大虾闯片场",
      description: "大虾队长带你逛遍 AI 片场:剧本间、资产库、分镜台的幕后故事。",
      coverUrl: "/demo/series-daxia.svg",
      authorName: "漫剧大虾官方",
      episodes: {
        create: [
          { order: 1, title: "剧本间的秘密", videoUrl: DEMO_VIDEO, duration: 55 },
          { order: 2, title: "资产库奇遇", videoUrl: DEMO_VIDEO, duration: 60 },
          { order: 3, title: "分镜台之夜", videoUrl: DEMO_VIDEO, duration: 57 },
        ],
      },
    },
  });

  console.log(`Seeded demo project: /p/${project.shareToken} + 3 works`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
