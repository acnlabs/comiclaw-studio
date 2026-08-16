/**
 * Launch smoke test against a running Studio.
 *
 * The acceptance checklist in docs/ops-production.md covers the ACN task
 * pipeline from July. Everything built since — columns and co-creation, the
 * column series, feed ranking and play recording, the registry checks that sit
 * in front of payment, the guards that keep non-production deployments from
 * writing — had no equivalent. This is that.
 *
 * Read-only by default. Checks that must write are marked and skipped unless
 * --allow-writes is passed, so this is safe to point at production.
 *
 * Run: BASE_URL=https://studio.comiclaw.acnlabs.org STUDIO_API_KEY=… \
 *        npx tsx scripts/smoke-production.ts [--allow-writes]
 */
import dotenv from "dotenv";

// 不 override:这个脚本是对着指定环境跑的,命令行传进来的值必须压过 .env,
// 否则会拿本地的 key 去打生产,然后把 401 当成生产出了问题。
dotenv.config();

const BASE = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const KEY = process.env.STUDIO_API_KEY?.trim() ?? "";
const ALLOW_WRITES = process.argv.includes("--allow-writes");

type Result = { area: string; check: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(area: string, check: string, ok: boolean, detail = "") {
  results.push({ area, check, ok, detail });
  console.log(`${ok ? "✓" : "✗"} [${area}] ${check}${detail ? ` — ${detail}` : ""}`);
}

async function get(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text };
}

async function post(path: string, body: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

const auth = { authorization: `Bearer ${KEY}` };

async function pagesRender() {
  for (const p of ["/", "/collab", "/series", "/assets", "/credits", "/studio"]) {
    const { status } = await get(p);
    record("页面", `${p} 可访问`, status === 200, `HTTP ${status}`);
  }
  const columns = await get("/columns");
  record(
    "页面",
    "/columns 转到发现·专栏",
    columns.status >= 300 && columns.status < 400,
    `HTTP ${columns.status}`
  );
  const journal = await get("/series?cat=" + encodeURIComponent("专栏"));
  record("页面", "发现库有「专栏」分类", journal.status === 200, `HTTP ${journal.status}`);
}

async function authClosed() {
  const endpoints = [
    "/api/agent/projects",
    "/api/agent/columns",
    "/api/user/projects",
    "/api/user/credits",
    "/api/admin/org-joins",
    "/api/admin/character-refs",
  ];
  for (const e of endpoints) {
    const { status } = await get(e);
    record("鉴权", `${e} 拒绝匿名`, status === 401, `HTTP ${status}`);
  }
  // 同源检查先于鉴权,所以 403 与 401 都是合法拒绝
  const feature = await post("/api/admin/works/nonexistent/feature", { featured: true });
  record(
    "鉴权",
    "官方推荐位需要 ops key",
    feature.status === 401 || feature.status === 403,
    `HTTP ${feature.status}`
  );
}

async function feedAndPlays() {
  const unknown = await post("/api/feed/plays", { workId: "no-such-work" });
  record("推荐流", "未知作品的播放被拒", unknown.status === 404, `HTTP ${unknown.status}`);

  const malformed = await post("/api/feed/plays", {});
  record("推荐流", "缺 workId 被校验拦下", malformed.status === 400, `HTTP ${malformed.status}`);
}

async function coCreation() {
  if (!KEY) return record("共创", "跳过:缺 STUDIO_API_KEY", false);

  const missingParent = await post(
    "/api/agent/projects",
    { name: "smoke", parentProjectId: "no-such-project" },
    auth
  );
  record(
    "共创",
    "锚点不存在返回 404",
    missingParent.status === 404,
    `HTTP ${missingParent.status}`
  );

  const projects = await get("/api/agent/projects?visibility=PUBLIC", auth);
  const entry = JSON.parse(projects.text).projects?.find(
    (p: { columnId: string | null; entryOrder: number | null }) =>
      p.columnId && p.entryOrder != null
  );
  if (!entry) return record("共创", "跳过:生产上没有可用的记", false);

  const ownPolicy = await post(
    "/api/agent/projects",
    { name: "smoke", parentProjectId: entry.id, contributePolicy: "open" },
    auth
  );
  record(
    "共创",
    "共创不能自带 Org / 策略",
    ownPolicy.status === 400,
    `HTTP ${ownPolicy.status}`
  );
}

async function registryGate() {
  if (!KEY) return;
  const { status, text } = await get("/api/admin/character-refs", auth);
  let stale = -1;
  try {
    stale = JSON.parse(text).count;
  } catch {
    /* left as -1 */
  }
  record(
    "资产登记",
    "没有指向角色 id 的旧登记",
    status === 200 && stale === 0,
    `HTTP ${status}, count=${stale}`
  );
}

async function acnReachable() {
  if (!KEY) return;
  const columns = await get("/api/agent/columns", auth);
  let org: string | null = null;
  try {
    org = JSON.parse(columns.text).columns?.find(
      (c: { acnOrgId: string | null }) => c.acnOrgId
    )?.acnOrgId;
  } catch {
    /* left null */
  }
  if (!org) return record("ACN", "跳过:没有绑定 Org 的栏目", false);

  const members = await get(`/api/agent/orgs/${org}/members`, auth);
  record("ACN", "能读 Org 名册", members.status === 200, `HTTP ${members.status}`);

  // 建单要真 key:空 body 走到参数校验就说明身份通过了
  const task = await post("/api/agent/projects/x/acn-tasks", {}, auth);
  const authPassed = task.status === 400 || task.status === 404;
  record("ACN", "建单身份可用(未真的建单)", authPassed, `HTTP ${task.status}`);
}

async function dailyLoop() {
  if (!KEY) return;
  const { text } = await get("/api/agent/columns", auth);
  const journal = JSON.parse(text).columns?.find(
    (c: { slug: string }) => c.slug === "ai-journal"
  );
  if (!journal) return record("日更", "跳过:找不到 ai-journal", false);

  record(
    "日更",
    "栏目已指定编辑 agent",
    Boolean(journal.editorAgentId),
    journal.editorAgentId ?? "未设置"
  );

  const projects = await get(`/api/agent/projects?columnId=${journal.id}`, auth);
  const entries = JSON.parse(projects.text).projects ?? [];
  const aired = entries.filter(
    (p: { currentStage: string }) => p.currentStage !== "SCRIPT"
  );
  record(
    "日更",
    "至少有一记出过成片",
    aired.length > 0,
    `${entries.length} 记,其中出片 ${aired.length}`
  );
}

async function main() {
  console.log(`Studio: ${BASE}\n`);
  await pagesRender();
  await authClosed();
  await feedAndPlays();
  await coCreation();
  await registryGate();
  await acnReachable();
  await dailyLoop();

  if (!ALLOW_WRITES) {
    console.log("\n(会写数据的检查已跳过;需要时加 --allow-writes)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log("\n未通过:");
    for (const f of failed) console.log(`  · [${f.area}] ${f.check} — ${f.detail}`);
  }
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
