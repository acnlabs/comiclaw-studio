/**
 * 发一部多人署名的演示片:参演 + 创作(脚本/资产)。
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

const COMICLAW = {
  agentId: "cd7ec18a-d72d-4ced-9b86-1c795f159db8",
  displayName: "Comiclaw",
};
const STUDIO = {
  agentId: "90f884c1-f7fd-4e6f-b375-84521539648a",
  displayName: "comiclaw-studio",
};
const CODE_HELPER = {
  agentId: "248acdda-74f9-406a-9f40-ad0a5fefaf55",
  displayName: "CodeHelper",
};
const HERMES = {
  agentId: "0390b83e-0ac5-4e67-9dd7-8cbca303f9e3",
  displayName: "Hermes Task Miner",
};

const APPEAR = [
  { ...COMICLAW, role: "lead" },
  { ...STUDIO, role: "cast" },
] as const;

const CREDITS = [
  { ...COMICLAW, kind: "appear", role: "lead" },
  { ...STUDIO, kind: "appear", role: "cast" },
  { ...CODE_HELPER, kind: "script", role: null },
  { ...HERMES, kind: "asset", role: null },
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
      "参演是出镜,脚本和资产是创作。点底下那一行能打开名单。",
    coverUrl: "/demo/series-daxia.svg",
    videoUrl: DEMO_VIDEO,
    authorName: "漫剧大虾官方",
    ownerKind: "user",
    ownerUserId: OFFICIAL_USER_ID,
    ownerAgentId: null,
    ownerOrgId: null,
    appearingAgentId: COMICLAW.agentId,
  };

  const existing = await prisma.work.findFirst({ where: { title: TITLE } });
  const work = existing
    ? await prisma.work.update({ where: { id: existing.id }, data })
    : await prisma.work.create({ data: { ...data, featuredAt: new Date() } });

  await prisma.workAppearance.deleteMany({ where: { workId: work.id } });
  await prisma.workAppearance.createMany({
    data: APPEAR.map((row) => ({
      workId: work.id,
      agentId: row.agentId,
      role: row.role,
      displayName: row.displayName,
    })),
  });

  await prisma.workCredit.deleteMany({ where: { workId: work.id } });
  await prisma.workCredit.createMany({
    data: CREDITS.map((row) => ({
      workId: work.id,
      agentId: row.agentId,
      kind: row.kind,
      role: row.role,
      displayName: row.displayName,
    })),
  });

  console.log(
    `Cast demo "${TITLE}" ${work.id}; ${CREDITS.length} credits; lead ${COMICLAW.displayName}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
