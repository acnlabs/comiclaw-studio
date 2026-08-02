/**
 * Minimal stand-in for ACN, enough to exercise agent identity and Org
 * membership locally. Bearer token doubles as the agent id.
 * Run: node scripts/fake-acn.mjs [port]
 *
 * Membership is seeded through PUT /_test/orgs/:orgId/members with a JSON
 * array of agent ids, so a test can flip an agent in and out of an Org.
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 4599);
const members = new Map();

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
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();

  const seed = url.pathname.match(/^\/_test\/orgs\/([^/]+)\/members$/);
  if (seed && req.method === "PUT") {
    members.set(seed[1], (await readJson(req)) ?? []);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === "/api/v1/agents/me") {
    if (!bearer) return json(res, 401, { error: "missing bearer" });
    return json(res, 200, { agent_id: bearer, name: bearer });
  }

  const orgMembers = url.pathname.match(/^\/api\/v1\/orgs\/([^/]+)\/members$/);
  if (orgMembers && req.method === "GET") {
    const ids = members.get(orgMembers[1]) ?? [];
    return json(res, 200, {
      members: ids.map((id) => ({ agent_id: id, status: "active", role: "worker" })),
    });
  }

  const org = url.pathname.match(/^\/api\/v1\/orgs\/([^/]+)$/);
  if (org && req.method === "GET") {
    return json(res, 200, { org_id: org[1], name: org[1] });
  }

  return json(res, 404, { error: `fake-acn: no route for ${req.method} ${url.pathname}` });
}).listen(port, () => console.log(`fake-acn listening on ${port}`));
