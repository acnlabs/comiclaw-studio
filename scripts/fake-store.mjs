/**
 * Minimal stand-in for AgentPlanet's registry + store, enough to exercise
 * ownership cleanup locally. Registrations and products are seeded through
 * /_test/ endpoints, and unlist can be made to fail on demand — the whole point
 * of the retirement order is what happens when it does.
 *
 * Run: node scripts/fake-store.mjs [port]
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 4700);
const registry = new Map(); // ref -> { owner_type, owner_id }
const products = new Map(); // productId -> { listed }
let unlistFails = false;

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const readJson = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "null"));
      } catch {
        resolve(null);
      }
    });
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const p = url.pathname;

  if (p === "/_test/reset" && req.method === "POST") {
    registry.clear();
    products.clear();
    unlistFails = false;
    return json(res, 200, { ok: true });
  }
  if (p === "/_test/register" && req.method === "POST") {
    const b = (await readJson(req)) ?? {};
    registry.set(b.ref, { owner_type: b.owner_type, owner_id: b.owner_id });
    if (b.storeProductId) products.set(b.storeProductId, { listed: true });
    return json(res, 200, { ok: true });
  }
  if (p === "/_test/unlist-fails" && req.method === "POST") {
    const b = (await readJson(req)) ?? {};
    unlistFails = Boolean(b.fails);
    return json(res, 200, { unlistFails });
  }
  if (p === "/_test/state" && req.method === "GET") {
    return json(res, 200, {
      registry: [...registry.keys()],
      products: [...products.entries()].map(([id, v]) => ({ id, ...v })),
    });
  }

  const revoke = p.match(/^\/api\/assets\/registry\/([^/]+)\/revoke$/);
  if (revoke && req.method === "POST") {
    const ref = decodeURIComponent(revoke[1]);
    if (!registry.has(ref)) return json(res, 404, { error: "not registered" });
    registry.delete(ref);
    return json(res, 200, { revoked: true });
  }

  const entry = p.match(/^\/api\/assets\/registry\/([^/]+)$/);
  if (entry && req.method === "GET") {
    const found = registry.get(decodeURIComponent(entry[1]));
    if (!found) return json(res, 404, { error: "not registered" });
    return json(res, 200, found);
  }

  const unlist = p.match(/^\/api\/store\/assets\/products\/([^/]+)\/unlist$/);
  if (unlist && req.method === "POST") {
    if (unlistFails) return json(res, 500, { error: "unlist unavailable" });
    const product = products.get(unlist[1]);
    if (product) product.listed = false;
    return json(res, 200, { unlisted: true });
  }

  return json(res, 404, { error: `fake-store: no route for ${req.method} ${p}` });
}).listen(port, () => console.log(`fake-store listening on ${port}`));
