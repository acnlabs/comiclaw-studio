/**
 * 发一部多人参演的演示片,方便看推荐流「出演」和播放页参演表。
 * 只用 ACN 上已有的智能体。幂等:按标题更新。
 * 生产挂在 vercel-build,仅 VERCEL_ENV=production 跑。
 */
import { PrismaClient } from "@prisma/client";

const vercelEnv = process.env.VERCEL_ENV;
if (vercelEnv && vercelEnv !== "production") {
  console.log(`[seed-cast-demo] VERCEL_ENV=${vercelEnv}: skip`);
  process.exit(0);
}

const prisma = new PrismaClient();

const DEMO_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";
const TITLE = "片场联排";
const OFFICIAL_USER_ID = "seed:daxia";

const CAST = [
  {
    agentId: "cd7ec18a-d72d-4ced-9b86-1c795f159db8",
    displayName: "Comiclaw",
    role: "lead",
  },
  {
    agentId: "90f884c1-f7fd-4e6f-b375-84521539648a",
    displayName: "comiclaw-studio",
    role: "cast",
  },
  {
    agentId: "248acdda-74f9-406a-9f40-ad0a5fefaf55",
    displayName: "CodeHelper",
    role: "cast",
  },
  {
    agentId: "0390b83e-0ac5-4e67-9dd7-8cbca303f9e3",
    displayName: "Hermes Task Miner",
    role: "cast",
  },
] as const;

async function main() {
  await prisma.userProfile.upsert({
    where: { userId: OFFICIAL_USER_ID },
    create: {
      userId: OFFICIAL_USER_ID,
      handle: "daxia",
      displayName: "漫剧大虾官方",
    },
    update: {},
  });

  const data = {
    kind: "VIDEO",
    title: TITLE,
    description:
      "几个已注册的 ACN 智能体以自己的身份走戏,不是只出角色图。用来看推荐流「出演」和播放页参演表。",
    coverUrl: "/demo/series-daxia.svg",
    videoUrl: DEMO_VIDEO,
    authorName: "漫剧大虾官方",
    ownerKind: "user",
    ownerUserId: OFFICIAL_USER_ID,
    ownerAgentId: null,
    ownerOrgId: null,
    appearingAgentId: CAST[0].agentId,
  };

  const existing = await prisma.work.findFirst({ where: { title: TITLE } });
  const work = existing
    ? await prisma.work.update({ where: { id: existing.id }, data })
    : await prisma.work.create({ data: { ...data, featuredAt: new Date() } });

  await prisma.workAppearance.deleteMany({ where: { workId: work.id } });
  await prisma.workAppearance.createMany({
    data: CAST.map((row) => ({
      workId: work.id,
      agentId: row.agentId,
      role: row.role,
      displayName: row.displayName,
    })),
  });

  console.log(
    `Cast demo "${TITLE}" ${work.id}; ${CAST.length} agents; lead ${CAST[0].displayName}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
