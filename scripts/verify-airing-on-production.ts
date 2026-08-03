/**
 * Prove the airing chain works on production, once, with a throwaway column.
 *
 * Entry → film → release → feed work → column series has only ever run against
 * a local server with fakes. The day comiclaw finally produces a hook video is
 * the wrong day to discover that production behaves differently.
 *
 * Everything is created under a temporary column and removed in `finally`,
 * including on failure. The window where a test item is visible is seconds.
 *
 * Run: BASE_URL=… STUDIO_API_KEY=… npx tsx scripts/verify-airing-on-production.ts
 */
import assert from "node:assert/strict";
import dotenv from "dotenv";

// 不 override:命令行传进来的目标环境必须压过 .env
dotenv.config();

const BASE = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const KEY = process.env.STUDIO_API_KEY?.trim();
const ok = (label: string) => console.log(`✓ ${label}`);

if (!KEY) {
  console.error("STUDIO_API_KEY is required");
  process.exit(1);
}

const auth = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: auth });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body: body as never };
}

async function page(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text() };
}

async function main() {
  const stamp = Date.now();
  let columnId: string | null = null;
  let projectId: string | null = null;

  try {
    const column = await api("/api/agent/columns", {
      method: "POST",
      body: JSON.stringify({
        slug: `airing-check-${stamp}`,
        name: `上线前链路自检 ${stamp}`,
        description: "临时栏目,验证完立即删除",
      }),
    });
    assert.equal(column.status, 201, `column: ${JSON.stringify(column.body)}`);
    columnId = (column.body as { column: { id: string } }).column.id;

    const project = await api("/api/agent/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `链路自检 · 第 1 记 ${stamp}`,
        visibility: "PUBLIC",
        columnId,
        agentName: "smoke",
      }),
    });
    assert.equal(project.status, 201, `project: ${JSON.stringify(project.body)}`);
    projectId = (project.body as { id: string }).id;
    ok("在临时栏目下开出一记");

    const videoUrl = `https://example.invalid/airing-check-${stamp}.mp4`;
    const film = await api(`/api/agent/projects/${projectId}/film-versions`, {
      method: "POST",
      // PUBLIC 的内容必须署名,用一个一眼看得出是自检的作者
      body: JSON.stringify({ videoUrl, duration: 15, authorAgentId: "smoke-airing-check" }),
    });
    assert.equal(film.status, 201, `film: ${JSON.stringify(film.body)}`);
    ok("挂上成片");

    const release = await api(`/api/agent/projects/${projectId}/releases`, {
      method: "POST",
      body: JSON.stringify({ platform: "studio", status: "PUBLISHED" }),
    });
    assert.equal(release.status, 201, `release: ${JSON.stringify(release.body)}`);
    ok("发行成功");

    // 发行会同步两件事:这一记成为独立作品,以及本栏目的记聚成系列
    const feed = await page("/");
    assert.equal(feed.status, 200);
    assert.ok(
      feed.html.includes(videoUrl),
      "这一记的成片应当出现在推荐流里"
    );
    ok("成片进入了「为你推荐」");

    const series = await page(`/series?cat=${encodeURIComponent("漫记")}`);
    assert.equal(series.status, 200);
    assert.ok(
      series.html.includes(`上线前链路自检 ${stamp}`),
      "本栏目应当作为一个系列出现在短剧库「漫记」下"
    );
    ok("栏目聚成系列,出现在短剧库「漫记」分类");

    const columnPage = await page(`/columns/airing-check-${stamp}`);
    assert.equal(columnPage.status, 200);
    assert.ok(columnPage.html.includes(`链路自检 · 第 1 记 ${stamp}`), "栏目页应列出这一记");
    ok("栏目页时间线正常");
  } finally {
    // 清理必须发生,失败时更要发生:作品随项目级联,系列随栏目级联
    if (projectId) {
      const del = await api(`/api/agent/projects/${projectId}`, { method: "DELETE" });
      console.log(`  清理项目 → HTTP ${del.status}`);
    }
    if (columnId) {
      const del = await api(`/api/agent/columns/${columnId}`, { method: "DELETE" });
      console.log(`  清理栏目 → HTTP ${del.status}`);
    }
  }

  // 清理之后必须回到原样,否则等于往生产里留了垃圾
  const after = await page(`/series?cat=${encodeURIComponent("漫记")}`);
  assert.ok(!after.html.includes("上线前链路自检"), "临时系列应当已经消失");
  const feedAfter = await page("/");
  assert.ok(!feedAfter.html.includes("airing-check-"), "临时作品应当已经消失");
  ok("清理干净,生产回到原样");

  console.log("\n生产上的出片链路可用");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
