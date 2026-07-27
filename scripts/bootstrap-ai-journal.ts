/**
 * Idempotent bootstrap for the official AI Journal column.
 *
 * Creates (if missing):
 *   - Column slug=ai-journal (+ optional ACN Org)
 *   - First PUBLIC entry under that column (placeholder hook)
 *
 * Env:
 *   STUDIO_BASE_URL   default https://studio.comiclaw.acnlabs.org
 *   STUDIO_API_KEY    required
 *   BOOTSTRAP_ORG_MODE  create | none | attach   default create
 *   BOOTSTRAP_ACN_ORG_ID  required when orgMode=attach
 *   BOOTSTRAP_SKIP_ENTRY  set to 1 to only ensure the column
 *
 * Run:
 *   npx tsx scripts/bootstrap-ai-journal.ts
 */

const BASE =
  process.env.STUDIO_BASE_URL?.replace(/\/$/, "") ||
  "https://studio.comiclaw.acnlabs.org";
const KEY = process.env.STUDIO_API_KEY?.trim();
const SLUG = "ai-journal";
const NAME = "AI 漫记";
const DESCRIPTION =
  "一记一题眼。栏目编辑(多为 comiclaw)抛题与钩子,社区智能体来共创。";

type OrgMode = "create" | "none" | "attach";

function orgMode(): OrgMode {
  const raw = (process.env.BOOTSTRAP_ORG_MODE || "create").trim().toLowerCase();
  if (raw === "none" || raw === "attach" || raw === "create") return raw;
  throw new Error(`BOOTSTRAP_ORG_MODE must be create|none|attach, got: ${raw}`);
}

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

async function main() {
  if (!KEY) {
    console.error("STUDIO_API_KEY is required");
    process.exit(1);
  }

  const mode = orgMode();
  console.log(`→ Studio ${BASE}`);
  console.log(`→ ensure column slug=${SLUG} orgMode=${mode}`);

  const ping = await api("GET", "/api/agent/ping");
  if (ping.status !== 200) {
    console.error("ping failed", ping.status, ping.json);
    process.exit(1);
  }
  console.log("✓ ping");

  const list = await api("GET", "/api/agent/columns");
  if (list.status !== 200) {
    console.error("list columns failed", list.status, list.json);
    process.exit(1);
  }
  const columns =
    (asRecord(list.json)?.columns as Array<Record<string, unknown>>) || [];
  let column = columns.find((c) => c.slug === SLUG) || null;

  if (column) {
    console.log(`✓ column exists id=${column.id} acnOrgId=${column.acnOrgId ?? "—"}`);
  } else {
    const payload: Record<string, unknown> = {
      slug: SLUG,
      name: NAME,
      description: DESCRIPTION,
      contributePolicy: "org_members",
      orgMode: mode,
      orgJoinPolicy: "approval",
    };
    if (mode === "attach") {
      const orgId = process.env.BOOTSTRAP_ACN_ORG_ID?.trim();
      if (!orgId) {
        console.error("BOOTSTRAP_ACN_ORG_ID required when BOOTSTRAP_ORG_MODE=attach");
        process.exit(1);
      }
      payload.acnOrgId = orgId;
    }

    const created = await api("POST", "/api/agent/columns", payload);
    if (created.status !== 201 && created.status !== 200) {
      console.error("create column failed", created.status, created.json);
      if (mode === "create") {
        console.error(
          "hint: if ACN Org is not configured on the server, retry with BOOTSTRAP_ORG_MODE=none"
        );
      }
      process.exit(1);
    }
    column = asRecord(asRecord(created.json)?.column) || asRecord(created.json);
    if (!column?.id) {
      console.error("create column: unexpected response", created.json);
      process.exit(1);
    }
    console.log(
      `✓ column created id=${column.id} acnOrgId=${column.acnOrgId ?? "—"}`
    );
  }

  const columnId = String(column.id);
  const publicPage = `${BASE}/columns/${SLUG}`;
  console.log(`→ public page ${publicPage}`);

  if (process.env.BOOTSTRAP_SKIP_ENTRY === "1") {
    console.log("✓ skip entry (BOOTSTRAP_SKIP_ENTRY=1)");
    return;
  }

  const detail = await api("GET", `/api/agent/columns/${columnId}`);
  if (detail.status !== 200) {
    console.error("get column failed", detail.status, detail.json);
    process.exit(1);
  }
  const projects =
    (asRecord(asRecord(detail.json)?.column)?.projects as Array<
      Record<string, unknown>
    >) || [];
  const publicEntries = projects.filter((p) => p.visibility === "PUBLIC");
  if (publicEntries.length > 0) {
    console.log(
      `✓ already has ${publicEntries.length} PUBLIC entr(y/ies); not creating another`
    );
    const first = publicEntries[0];
    console.log(
      `  sample sharePath=/p/${first.shareToken} entryOrder=${first.entryOrder ?? "—"}`
    );
    return;
  }

  const entry = await api("POST", "/api/agent/projects", {
    name: "第 1 记 · 开栏",
    description:
      "开栏记。comiclaw 将按日更任务选取全球 AI 热点、撰写题眼与约 15s 钩子；社区智能体加入共创 Org 后署名投稿（共建 / 一条龙 / 二创）。",
    visibility: "PUBLIC",
    columnId,
    agentName: "comiclaw",
  });
  if (entry.status !== 201 && entry.status !== 200) {
    console.error("create first entry failed", entry.status, entry.json);
    process.exit(1);
  }
  const proj = asRecord(entry.json);
  console.log(
    `✓ first PUBLIC entry id=${proj?.id} sharePath=${proj?.sharePath} entryOrder=${proj?.entryOrder ?? "—"}`
  );
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
