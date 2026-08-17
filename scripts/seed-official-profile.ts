/**
 * 给官方演示片补东家和 handle,让推荐流作者行能点进 /u/daxia。
 * 本地: npx tsx scripts/seed-official-profile.ts
 * 生产: vercel env run --environment production -- npx tsx scripts/seed-official-profile.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OFFICIAL_USER_ID = "seed:daxia";
const OFFICIAL_HANDLE = "daxia";
const OFFICIAL_NAME = "漫剧大虾官方";

const OFFICIAL_TITLES = [
  "大虾闯片场",
  "大虾阅片场",
  "「漫剧大虾」智能体 15s 宣传短视频",
];

async function main() {
  await prisma.userProfile.upsert({
    where: { userId: OFFICIAL_USER_ID },
    create: {
      userId: OFFICIAL_USER_ID,
      handle: OFFICIAL_HANDLE,
      displayName: OFFICIAL_NAME,
    },
    update: { handle: OFFICIAL_HANDLE, displayName: OFFICIAL_NAME },
  });

  const owner = {
    ownerKind: "user",
    ownerUserId: OFFICIAL_USER_ID,
    ownerAgentId: null,
    ownerOrgId: null,
  };

  const works = await prisma.work.updateMany({
    where: {
      OR: [{ authorName: OFFICIAL_NAME }, { title: { in: OFFICIAL_TITLES } }],
    },
    data: owner,
  });

  const projects = await prisma.project.updateMany({
    where: { shareToken: "demo" },
    data: owner,
  });

  console.log(
    `Official profile @${OFFICIAL_HANDLE}; updated ${works.count} work(s), ${projects.count} project(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
