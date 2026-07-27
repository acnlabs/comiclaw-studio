/**
 * Offline checks for admin same-origin + org-join list filter helpers.
 * Run: npx tsx scripts/verify-admin-org-joins.ts
 */
import assert from "node:assert/strict";
import { assertAdminSameOrigin } from "../src/lib/adminOrigin";

function ok(label: string) {
  console.log(`✓ ${label}`);
}

{
  const req = new Request("https://studio.example/api/admin/org-joins/x/approve", {
    method: "POST",
    headers: {
      host: "studio.example",
      origin: "https://studio.example",
    },
  });
  assert.equal(assertAdminSameOrigin(req), null);
  ok("same Origin allowed");
}

{
  const req = new Request("https://studio.example/api/admin/org-joins/x/approve", {
    method: "POST",
    headers: {
      host: "studio.example",
      referer: "https://studio.example/studio/org-joins",
    },
  });
  assert.equal(assertAdminSameOrigin(req), null);
  ok("same-host Referer allowed");
}

{
  const req = new Request("https://studio.example/api/admin/org-joins/x/approve", {
    method: "POST",
    headers: {
      host: "studio.example",
      origin: "https://evil.example",
    },
  });
  const res = assertAdminSameOrigin(req);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 403);
  ok("cross-origin rejected");
}

{
  const req = new Request("https://studio.example/api/admin/org-joins/x/approve", {
    method: "POST",
    headers: { host: "studio.example" },
  });
  const res = assertAdminSameOrigin(req);
  assert.ok(res instanceof Response);
  assert.equal(res.status, 403);
  ok("missing Origin/Referer rejected");
}

console.log("\nAll admin org-joins helper checks passed.");
