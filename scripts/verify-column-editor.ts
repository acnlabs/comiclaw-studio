/**
 * Offline checks for who may open a column entry.
 * Run: npx tsx scripts/verify-column-editor.ts
 */
import assert from "node:assert/strict";
import { canOpenEntry } from "../src/lib/columnEditor";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

const entry = { visibility: "PUBLIC", columnId: "col_1", wantsOrgBind: false };
const edited = { editorAgentId: "comiclaw-agent" };
const comiclaw = { kind: "agent", agentId: "comiclaw-agent" } as const;
const studio = { kind: "studio_key" } as const;

// The whole point: the daily loop's first step stops needing the ops key.
assert.deepEqual(
  canOpenEntry({ request: entry, column: edited, opener: comiclaw }),
  { ok: true }
);
ok("a column's editor opens that column's entry as itself");

// Everything the Studio key could do, it still can.
assert.deepEqual(
  canOpenEntry({
    request: { visibility: "PRIVATE", columnId: null, wantsOrgBind: true },
    column: null,
    opener: studio,
  }),
  { ok: true }
);
ok("the Studio key is unchanged: private projects, no column, Org binding");

// The opening is narrow on purpose — an agent identity must not become a
// general project-creation credential.
assert.deepEqual(
  canOpenEntry({
    request: { ...entry, visibility: "PRIVATE" },
    column: edited,
    opener: comiclaw,
  }),
  { ok: false, reason: "not_public" }
);
assert.deepEqual(
  canOpenEntry({
    request: { ...entry, columnId: null },
    column: null,
    opener: comiclaw,
  }),
  { ok: false, reason: "no_column" }
);
ok("an agent cannot create private or column-less projects");

assert.deepEqual(
  canOpenEntry({
    request: entry,
    column: { editorAgentId: "someone-else" },
    opener: comiclaw,
  }),
  { ok: false, reason: "not_the_editor" }
);
assert.deepEqual(
  canOpenEntry({ request: entry, column: { editorAgentId: null }, opener: comiclaw }),
  { ok: false, reason: "column_has_no_editor" }
);
ok("only the named editor gets in, and only where one is named");

// Binding an Org decides where money and governance land. Opening today's
// entry is not the moment to let an agent make that call.
assert.deepEqual(
  canOpenEntry({
    request: { ...entry, wantsOrgBind: true },
    column: edited,
    opener: comiclaw,
  }),
  { ok: false, reason: "org_bind_not_allowed" }
);
ok("an editor cannot bind an Org while opening an entry");

console.log("\nAll column-editor checks passed.");
