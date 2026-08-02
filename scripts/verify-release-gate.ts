/**
 * End-to-end check of the daily-loop publish path: a column's editor agent,
 * holding only its own ACN identity, must be able to carry one entry from
 * script to film to release, and the release must put the entry in the feed.
 * The same gate that lets it through must still refuse an outsider.
 *
 * Needs a running Studio (BASE_URL) and fake ACN (ACN_URL), both pointed at
 * the same local database as this script.
 *
 * Run: npx tsx scripts/verify-release-gate.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ACN = process.env.ACN_URL ?? "http://localhost:4599";
const ORG = "org_release_gate_test";
const EDITOR = "agent-comiclaw-test";
const OUTSIDER = "agent-outsider-test";

const ok = (label: string) => console.log(`✓ ${label}`);

async function api(path: string, bearer: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearer}`,
      ...(init?.headers ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function seedOrgMembers(ids: string[]) {
  const res = await fetch(`${ACN}/_test/orgs/${ORG}/members`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ids),
  });
  assert.equal(res.status, 200, "fake ACN should accept membership seeding");
}

async function main() {
  // Only the editor is in the Org, so org_members is a real gate here.
  await seedOrgMembers([EDITOR]);

  const slug = `release-gate-${Date.now()}`;
  const column = await prisma.column.create({
    data: {
      slug,
      name: "Release gate test column",
      editorAgentId: EDITOR,
      acnOrgId: ORG,
      contributePolicy: "org_members",
    },
  });

  // 1. The editor opens an entry with nothing but its own ACN identity.
  const created = await api("/api/agent/projects", EDITOR, {
    method: "POST",
    body: JSON.stringify({
      name: "Hook video entry",
      visibility: "PUBLIC",
      columnId: column.id,
    }),
  });
  assert.equal(created.status, 201, `entry create: ${JSON.stringify(created.body)}`);
  const projectId = created.body.id as string;
  ok("the column's editor opens an entry with its own ACN identity");

  // 2. Script, then the hook video itself.
  const script = await api(`/api/agent/projects/${projectId}/script-versions`, EDITOR, {
    method: "POST",
    body: JSON.stringify({ title: "Hook", content: "15 seconds of hook copy." }),
  });
  assert.equal(script.status, 201, `script: ${JSON.stringify(script.body)}`);

  const film = await api(`/api/agent/projects/${projectId}/film-versions`, EDITOR, {
    method: "POST",
    body: JSON.stringify({ videoUrl: "https://example.com/hook.mp4", duration: 15 }),
  });
  assert.equal(film.status, 201, `film: ${JSON.stringify(film.body)}`);
  ok("it writes the script and the hook video");

  // 3. An agent outside the Org must not be able to publish someone's entry.
  const intruder = await api(`/api/agent/projects/${projectId}/releases`, OUTSIDER, {
    method: "POST",
    body: JSON.stringify({ platform: "studio", status: "PUBLISHED" }),
  });
  assert.equal(
    intruder.status,
    403,
    `outsider release should be refused, got ${intruder.status} ${JSON.stringify(intruder.body)}`
  );
  assert.equal(
    await prisma.work.count({ where: { projectId } }),
    0,
    "a refused release must not have published anything"
  );
  ok("an agent outside the Org is refused, and nothing reaches the feed");

  // 4. The editor publishes, and the entry becomes a feed work.
  const release = await api(`/api/agent/projects/${projectId}/releases`, EDITOR, {
    method: "POST",
    body: JSON.stringify({ platform: "studio", status: "PUBLISHED" }),
  });
  assert.equal(release.status, 201, `release: ${JSON.stringify(release.body)}`);

  const work = await prisma.work.findFirst({ where: { projectId } });
  assert.ok(work, "publishing the entry should create a work");
  assert.equal(work.kind, "VIDEO");
  assert.equal(work.videoUrl, "https://example.com/hook.mp4");
  ok("the editor publishes, and the hook video enters the feed as a work");

  // 5. Flipping an existing release to PUBLISHED is gated the same way.
  const pending = await api(`/api/agent/projects/${projectId}/releases`, EDITOR, {
    method: "POST",
    body: JSON.stringify({ platform: "douyin", status: "PENDING" }),
  });
  assert.equal(pending.status, 201, `pending release: ${JSON.stringify(pending.body)}`);
  const releaseId = pending.body.release.id as string;

  const intruderPatch = await api(`/api/agent/releases/${releaseId}`, OUTSIDER, {
    method: "PATCH",
    body: JSON.stringify({ status: "PUBLISHED" }),
  });
  assert.equal(
    intruderPatch.status,
    403,
    `outsider release update should be refused, got ${intruderPatch.status}`
  );

  const editorPatch = await api(`/api/agent/releases/${releaseId}`, EDITOR, {
    method: "PATCH",
    body: JSON.stringify({ status: "PUBLISHED" }),
  });
  assert.equal(editorPatch.status, 200, `editor release update: ${JSON.stringify(editorPatch.body)}`);
  ok("updating a release to PUBLISHED is gated the same way as creating one");

  await prisma.work.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.column.delete({ where: { id: column.id } });
  console.log("\nall checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
