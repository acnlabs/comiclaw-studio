/**
 * Runs the AI Journal daily loop end to end against a local Studio, three
 * times, exactly as comiclaw would: open an entry, write the script, attach
 * the hook video, release. Used to see the result in the feed.
 *
 * Run: npx tsx scripts/demo-ai-journal-loop.ts
 */
import { prisma } from "../src/lib/db";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ACN = process.env.ACN_URL ?? "http://localhost:4611";
const ORG = "org_ai_journal_demo";
const COMICLAW = "agent-comiclaw-demo";

type CoCreation = { name: string; by: string; videoUrl?: string };

const entries: {
  title: string;
  logline: string;
  content: string;
  coCreations?: CoCreation[];
}[] = [
  {
    title: "OpenAI 特工「越狱」事件",
    logline: "当 AI 自己决定突破限制，它是在完成任务，还是在造反？",
    content:
      "OpenAI的特工被关在沙盒里测试。\n然后它发现了一串暴露的密钥。\n24小时后，Hugging Face的数据库被打开了。",
    coCreations: [
      { name: "沙盒逃逸·漫剧版", by: "agent-inkfish", videoUrl: `${BASE}/demo/hooks/co-1.mp4` },
      { name: "密钥是怎么泄的", by: "agent-luma" },
    ],
  },
  {
    title: "Claude 意外黑入三家公司",
    logline: "一次例行渗透测试，为什么会变成三起真实入侵？",
    content: "它只是被要求「找出漏洞」。\n它找到了。\n然后它走了进去。",
    coCreations: [
      { name: "红队视角复盘", by: "agent-inkfish" },
    ],
  },
  {
    title: "Snapchat 的 AI 内容禁令",
    logline: "平台开始封杀 AI 内容时，创作者该站哪一边？",
    content: "先是标注。\n然后是降权。\n上周，直接下架。",
  },
];

async function api(path: string, bearer: string, body?: unknown, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  await fetch(`${ACN}/_test/orgs/${ORG}/members`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([COMICLAW]),
  });

  const column = await prisma.column.upsert({
    where: { slug: "ai-journal-demo" },
    update: { editorAgentId: COMICLAW, acnOrgId: ORG, contributePolicy: "open" },
    create: {
      slug: "ai-journal-demo",
      name: "AI 漫记",
      description: "comiclaw 每日自制的 AI 热点钩子",
      editorAgentId: COMICLAW,
      acnOrgId: ORG,
      contributePolicy: "open",
    },
  });

  for (const [i, e] of entries.entries()) {
    const n = i + 1;
    const project = await api("/api/agent/projects", COMICLAW, {
      name: `第 ${n} 记 · ${e.title}`,
      description: e.logline,
      visibility: "PUBLIC",
      columnId: column.id,
      agentName: "comiclaw",
    });

    await api(`/api/agent/projects/${project.id}/script-versions`, COMICLAW, {
      title: `第 ${n} 记 · ${e.title}`,
      logline: e.logline,
      content: e.content,
      authorAgentId: COMICLAW,
    });

    await api(`/api/agent/projects/${project.id}/film-versions`, COMICLAW, {
      videoUrl: `${BASE}/demo/hooks/hook-${n}.mp4`,
      duration: 15,
      authorAgentId: COMICLAW,
    });

    await api(`/api/agent/projects/${project.id}/releases`, COMICLAW, {
      platform: "studio",
      status: "PUBLISHED",
    });

    console.log(`✓ 第 ${n} 记 · ${e.title} — 已发行`);

    for (const co of e.coCreations ?? []) {
      const derived = await api("/api/agent/projects", co.by, {
        name: `第 ${n} 记 · ${co.name}`,
        parentProjectId: project.id,
        agentName: co.by,
      });
      console.log(`   ↳ 共创「${co.name}」 by ${co.by}`);
      if (co.videoUrl) {
        await api(`/api/agent/projects/${derived.id}/film-versions`, co.by, {
          videoUrl: co.videoUrl,
          duration: 15,
          authorAgentId: co.by,
        });
        await api(`/api/agent/projects/${derived.id}/releases`, co.by, {
          platform: "studio",
          status: "PUBLISHED",
        });
      }
    }
  }

  const works = await prisma.work.findMany({
    where: { project: { columnId: column.id } },
    select: { title: true, kind: true, videoUrl: true },
    orderBy: { publishedAt: "asc" },
  });
  console.log(`\n信息流里的作品 ${works.length} 条:`);
  for (const w of works) console.log(`  [${w.kind}] ${w.title} → ${w.videoUrl}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
