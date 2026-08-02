/**
 * Checks the retirement of registry entries still keyed by a character's own id.
 *
 * The property that matters is the order: the product comes down before the
 * registration goes away. Getting that backwards leaves a listing that takes
 * money for a subject nobody honours, so a failed unlist has to stop the whole
 * thing rather than press on.
 *
 * Needs the fake store: node scripts/fake-store.mjs 4700
 * Run: AGENTPLANET_API_URL=http://localhost:4700 npx tsx scripts/verify-character-ref-retire.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { planRetirement, runRetirement } from "../src/lib/characterRefRetire";

const STORE = process.env.AGENTPLANET_API_URL ?? "http://localhost:4700";
const ok = (label: string) => console.log(`✓ ${label}`);

const post = (path: string, body?: unknown) =>
  fetch(`${STORE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const storeState = async () =>
  (await (await fetch(`${STORE}/_test/state`)).json()) as {
    registry: string[];
    products: { id: string; listed: boolean }[];
  };

async function seedCharacter(name: string, storeProductId: string | null) {
  return prisma.agentCharacter.create({
    data: {
      name,
      tagline: "retire test",
      imageUrl: "https://example.com/a.png",
      licensePoints: storeProductId ? 100 : 0,
      storeProductId,
    },
  });
}

async function main() {
  await post("/_test/reset");
  const created: string[] = [];

  // A character whose old registration still carries a live product.
  const paid = await seedCharacter("漫剧大虾(测试)", "prod_legacy_1");
  created.push(paid.id);
  await post("/_test/register", {
    ref: `comiclaw:character:${paid.id}`,
    owner_type: "user",
    owner_id: "auth0|someone",
    storeProductId: "prod_legacy_1",
  });

  // A character with no stale entry at all must be left alone.
  const clean = await seedCharacter("没有旧登记的(测试)", null);
  created.push(clean.id);

  const plan = await planRetirement();
  assert.deepEqual(
    plan.map((p) => p.characterId),
    [paid.id],
    `only the stale one should be planned, got ${JSON.stringify(plan)}`
  );
  assert.equal(plan[0].owner, "user:auth0|someone");
  assert.equal(plan[0].storeProductId, "prod_legacy_1");
  ok("the plan finds only characters whose own id is still registered");

  // Unlist failing must stop before revoking: otherwise the listing outlives
  // the registration and can still be paid for.
  await post("/_test/unlist-fails", { fails: true });
  const blocked = await runRetirement();
  assert.equal(blocked[0].unlisted, false);
  assert.equal(blocked[0].revoked, false, "a failed unlist must not revoke");
  let state = await storeState();
  assert.ok(
    state.registry.includes(`comiclaw:character:${paid.id}`),
    "the registration must survive a failed unlist"
  );
  ok("a failed unlist stops the retirement instead of pressing on");

  await post("/_test/unlist-fails", { fails: false });
  const done = await runRetirement();
  assert.equal(done[0].unlisted, true);
  assert.equal(done[0].revoked, true);
  state = await storeState();
  assert.equal(state.registry.length, 0, "the stale registration is gone");
  assert.deepEqual(
    state.products,
    [{ id: "prod_legacy_1", listed: false }],
    "the product came down too"
  );
  ok("with unlist working, the product comes down and the entry is revoked");

  assert.deepEqual(await planRetirement(), [], "nothing left to retire");
  ok("running it again is a no-op");

  await prisma.agentCharacter.deleteMany({ where: { id: { in: created } } });
  console.log("\nall character-ref retire checks passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
