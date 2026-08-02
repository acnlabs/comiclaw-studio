/**
 * End-to-end check of a 记's horizontal axis: other creators open their own
 * projects under an entry, own them, and appear in the feed on their own —
 * while the entry's vertical timeline, its entry count and the column series
 * keep counting only the entries themselves.
 *
 * Needs a running Studio (BASE_URL) and fake ACN (ACN_URL) on this database.
 * Run: npx tsx scripts/verify-entry-co-creations.ts
 */
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { prisma } from "../src/lib/db";

// The local Studio reads its keys from .env, so this script must too — a
// production key left in the shell would otherwise be sent to a dev server.
dotenv.config({ override: true });
import { syncColumnToSeries } from "../src/lib/publish";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ACN = process.env.ACN_URL ?? "http://localhost:4611";
const ORG = "org_co_creation_test";
const EDITOR = "agent-editor-test";
const OUTSIDER = "agent-outsider-test";

const ok = (label: string) => console.log(`✓ ${label}`);

async function api(path: string, bearer: string, body?: unknown, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function air(projectId: string, bearer: string, videoUrl: string) {
  const film = await api(`/api/agent/projects/${projectId}/film-versions`, bearer, {
    videoUrl,
    duration: 15,
    authorAgentId: bearer,
  });
  assert.equal(film.status, 201, `film: ${JSON.stringify(film.body)}`);
  const rel = await api(`/api/agent/projects/${projectId}/releases`, bearer, {
    platform: "studio",
    status: "PUBLISHED",
  });
  assert.equal(rel.status, 201, `release: ${JSON.stringify(rel.body)}`);
}

async function main() {
  await fetch(`${ACN}/_test/orgs/${ORG}/members`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([EDITOR]),
  });

  const column = await prisma.column.create({
    data: {
      slug: `co-creation-${Date.now()}`,
      name: "AI 漫记",
      editorAgentId: EDITOR,
      acnOrgId: ORG,
      contributePolicy: "open",
    },
  });

  // The editor opens 记 #1 — the official project, the anchor of this entry.
  const entry = await api("/api/agent/projects", EDITOR, {
    name: "第 1 记 · 官方",
    visibility: "PUBLIC",
    columnId: column.id,
    agentName: "comiclaw",
  });
  assert.equal(entry.status, 201, `entry: ${JSON.stringify(entry.body)}`);
  const entryId = entry.body.id as string;
  assert.equal(entry.body.entryOrder, 1);
  ok("the editor opens 记 #1 as the entry's official project");

  // Another creator brings their own project to the same 记. It is theirs.
  const derived = await api("/api/agent/projects", OUTSIDER, {
    name: "第 1 记 · 二创",
    parentProjectId: entryId,
    agentName: "someone-else",
  });
  assert.equal(derived.status, 201, `derived: ${JSON.stringify(derived.body)}`);
  const derivedId = derived.body.id as string;
  assert.equal(derived.body.parentProjectId, entryId);
  assert.equal(derived.body.entryOrder, null, "only the entry itself is numbered");
  assert.equal(derived.body.columnId, column.id, "a co-creation inherits the column");
  ok("another creator opens their own co-creation project under that 记");

  // Flat by design: you build on the 记, not on someone's derivative.
  const chained = await api("/api/agent/projects", OUTSIDER, {
    name: "二创的二创",
    parentProjectId: derivedId,
  });
  assert.equal(chained.status, 403, `chained should be refused, got ${chained.status}`);
  ok("a co-creation cannot itself be built on");

  // A co-creation inherits governance rather than declaring its own.
  const smuggled = await api("/api/agent/projects", OUTSIDER, {
    name: "自带策略",
    parentProjectId: entryId,
    contributePolicy: "owner_only",
  });
  assert.equal(smuggled.status, 400, `own policy should be refused, got ${smuggled.status}`);
  ok("a co-creation cannot bring its own Org or policy");

  // Vertical stays one row per 记 even though the 记 now holds two projects.
  const entries = await prisma.project.count({
    where: { columnId: column.id, visibility: "PUBLIC", parentProjectId: null },
  });
  const inColumn = await prisma.project.count({ where: { columnId: column.id } });
  assert.equal(entries, 1, "the timeline still shows one 记");
  assert.equal(inColumn, 2, "while the column holds both projects");
  ok("the vertical timeline counts 记, not projects");

  // Both air: each is its own work in the feed, but the series has one episode
  // for this 记 — the official one.
  await air(entryId, EDITOR, "https://example.com/official.mp4");
  await air(derivedId, OUTSIDER, "https://example.com/co-creation.mp4");

  const feed = await prisma.work.findMany({
    where: { columnId: null, project: { columnId: column.id } },
    select: { title: true },
    orderBy: { title: "asc" },
  });
  assert.deepEqual(
    feed.map((w) => w.title).sort(),
    ["第 1 记 · 二创", "第 1 记 · 官方"].sort(),
    `both projects should stand alone in the feed, got ${JSON.stringify(feed)}`
  );
  ok("the official project and the co-creation each enter the feed on their own");

  await syncColumnToSeries(column.id);
  const series = await prisma.work.findUnique({
    where: { columnId: column.id },
    include: { episodes: true },
  });
  assert.equal(series?.episodes.length, 1, "one 记 is one episode");
  assert.equal(series?.episodes[0].videoUrl, "https://example.com/official.mp4");
  ok("the series takes one episode per 记, from the official project");

  // Deleting the anchor would take other people's projects with it.
  const studioKey = process.env.STUDIO_API_KEY?.trim();
  assert.ok(studioKey, "STUDIO_API_KEY must be set to exercise the delete guard");
  const del = await api(`/api/agent/projects/${entryId}`, studioKey, undefined, "DELETE");
  assert.equal(del.status, 409, `anchor delete should conflict, got ${del.status}`);
  assert.ok(await prisma.project.findUnique({ where: { id: derivedId } }));
  ok("an entry anchoring others' co-creations cannot be deleted");

  await prisma.work.deleteMany({
    where: { OR: [{ columnId: column.id }, { project: { columnId: column.id } }] },
  });
  await prisma.project.deleteMany({ where: { parentProjectId: entryId } });
  await prisma.project.deleteMany({ where: { columnId: column.id } });
  await prisma.column.delete({ where: { id: column.id } });
  console.log("\nall entry co-creation checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
