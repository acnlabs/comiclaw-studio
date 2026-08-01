// Throwaway stand-ins for AgentPlanet (registry + store), ACN and Auth0.
// Enforces the things the real side enforces: closed change-owner reason
// vocabulary, and seller must equal the registered owner.
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import crypto, { generateKeyPairSync, createSign } from "node:crypto";
import { execSync } from "node:child_process";

fs.writeFileSync("/tmp/fake-ap-calls.jsonl", "");

const AGENTS = {
  "acn-key-alice": "11111111-1111-1111-1111-111111111111",
  "acn-key-bob": "22222222-2222-2222-2222-222222222222",
};
const ORG_MEMBERS = {
  org_a3a067ed8b4342b6bc4b82c7be3ea12c: [AGENTS["acn-key-alice"], AGENTS["acn-key-bob"]],
  org_demo_noodle: [],
};
const ALLOWED_REASONS = new Set(["rebind", "admin"]);

const registry = new Map();
const products = new Map();
const orders = new Map();
let seq = 0;

const AUDIENCE = "https://api.agentplanet.org";
const CLIENT_ID = "QLV1xUDPecgw9mqYlViaw2OZ8DzeEGGI";
const DOMAIN = "localhost:4600";
const KID = "test-key";
const NONCES = new Map();

let publicKey, privateKey;
if (fs.existsSync("/tmp/fake-auth0-key.pem")) {
  privateKey = crypto.createPrivateKey(fs.readFileSync("/tmp/fake-auth0-key.pem"));
  publicKey = crypto.createPublicKey(privateKey);
} else {
  ({ publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 }));
  fs.writeFileSync("/tmp/fake-auth0-key.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
}
const jwk = publicKey.export({ format: "jwk" });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function mintToken(sub, aud = AUDIENCE, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT", kid: KID });
  const body = b64({ sub, iss: `https://${DOMAIN}/`, aud, iat: now, exp: now + 3600, ...extra });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}
fs.writeFileSync(
  "/tmp/tokens.json",
  JSON.stringify({
    columnOwner: mintToken("auth0|columnowner"),
    stranger: mintToken("auth0|stranger"),
    demo: mintToken("auth0|demo"),
    demoId: mintToken("auth0|demo", CLIENT_ID, {
      name: "Demo",
      email: "demo@example.com",
      email_verified: true,
    }),
  })
);
execSync(
  "openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/k.pem -out /tmp/c.pem -days 2 -subj '/CN=localhost' 2>/dev/null"
);

https
  .createServer(
    { key: fs.readFileSync("/tmp/k.pem"), cert: fs.readFileSync("/tmp/c.pem") },
    async (req, res) => {
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      };
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        return res.end();
      }
      const url = new URL(req.url, `https://${DOMAIN}`);
      if (url.pathname === "/authorize") {
        const state = url.searchParams.get("state") ?? "";
        NONCES.set(state, url.searchParams.get("nonce") ?? "");
        res.writeHead(200, { ...cors, "content-type": "text/html" });
        return res.end(
          `<!doctype html><script>parent.postMessage({type:"authorization_response",response:{code:${JSON.stringify(
            state
          )},state:${JSON.stringify(state)}}},"*")</script>`
        );
      }
      if (url.pathname === "/oauth/token") {
        let raw = "";
        for await (const c of req) raw += c;
        let code = "";
        try {
          code = JSON.parse(raw).code ?? "";
        } catch {
          code = new URLSearchParams(raw).get("code") ?? "";
        }
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        return res.end(
          JSON.stringify({
            access_token: mintToken("auth0|demo"),
            id_token: mintToken("auth0|demo", CLIENT_ID, {
              name: "Demo",
              email: "demo@example.com",
              email_verified: true,
              nonce: NONCES.get(code) ?? "",
            }),
            scope: "openid profile email",
            expires_in: 3600,
            token_type: "Bearer",
          })
        );
      }
      res.writeHead(200, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [{ ...jwk, kid: KID, use: "sig", alg: "RS256" }] }));
    }
  )
  .listen(4600, () => console.log("fake Auth0 on :4600"));

http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    fs.appendFileSync(
      "/tmp/fake-ap-calls.jsonl",
      JSON.stringify({ method: req.method, url: req.url, body }) + "\n"
    );
    const send = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    const path = new URL(req.url, "http://x").pathname;

    if (path.includes("/agents/me")) {
      const key = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
      const id = AGENTS[key];
      return id ? send(200, { agent_id: id }) : send(401, { error: "unknown key" });
    }
    const om = path.match(/orgs\/([^/]+)\/members/);
    if (om) {
      return send(200, {
        members: (ORG_MEMBERS[decodeURIComponent(om[1])] ?? []).map((agent_id) => ({
          org_id: om[1],
          agent_id,
          role: "worker",
          status: "active",
        })),
      });
    }

    if (path === "/api/assets/registry" && req.method === "POST") {
      const ref = body.asset_ref;
      if (registry.has(ref)) return send(409, { error: "exists" });
      registry.set(ref, { owner_type: body.owner_type, owner_id: body.owner_id });
      return send(201, { ok: true });
    }
    const rm = path.match(/^\/api\/assets\/registry\/([^/]+)(\/(change-owner|revoke))?$/);
    if (rm) {
      const ref = decodeURIComponent(rm[1]);
      if (rm[3] === "change-owner") {
        if (!ALLOWED_REASONS.has(body?.reason)) {
          console.log("  REJECT change-owner reason:", body?.reason);
          return send(422, { error: "reason must be rebind|admin" });
        }
        if (!registry.has(ref)) return send(404, { error: "unknown" });
        registry.set(ref, { owner_type: body.owner_type, owner_id: body.owner_id });
        return send(200, { ok: true });
      }
      if (rm[3] === "revoke") {
        registry.delete(ref);
        return send(200, { ok: true });
      }
      const e = registry.get(ref);
      return e ? send(200, { asset_ref: ref, ...e }) : send(404, { error: "unknown" });
    }

    if (path === "/api/store/assets/products" && req.method === "POST") {
      const ref = body.asset_metadata?.asset_ref;
      const reg = registry.get(ref);
      if (!reg) return send(422, { error: "asset not registered" });
      if (reg.owner_type !== body.seller_type || reg.owner_id !== body.seller_id) {
        return send(403, { error: "seller is not the registered owner" });
      }
      const id = `prod_${++seq}`;
      products.set(id, {
        seller_id: body.seller_id,
        seller_type: body.seller_type,
        credits_price: body.credits_price,
        is_active: true,
        asset_ref: ref,
      });
      return send(201, { product_id: id });
    }
    const pm = path.match(/^\/api\/store\/assets\/products\/([^/]+)(\/(unlist|order))?$/);
    if (pm) {
      const product = products.get(pm[1]);
      if (!product) return send(404, { error: "unknown product" });
      if (pm[3] === "unlist") {
        if (body?.seller_id !== product.seller_id) return send(403, { error: "not the seller" });
        product.is_active = false;
        return send(200, { ok: true });
      }
      if (pm[3] === "order") {
        if (!product.is_active) return send(409, { error: "not on sale" });
        const orderId = `order_${++seq}`;
        orders.set(orderId, {
          product_id: pm[1],
          state: "pending",
          buyer_id: null,
          amount_credits: product.credits_price,
          seller_id: product.seller_id,
        });
        return send(201, {
          order_id: orderId,
          url: `https://agentplanet.example/checkout/${orderId}`,
          amount_credits: product.credits_price,
        });
      }
      if (req.method === "PATCH") {
        if (body?.seller_id !== product.seller_id) return send(403, { error: "not the seller" });
        if (body.credits_price !== undefined) product.credits_price = body.credits_price;
        if (body.is_active !== undefined) product.is_active = body.is_active;
        return send(200, { ok: true });
      }
      return send(200, { product_id: pm[1], is_active: product.is_active, review_status: "approved" });
    }
    const cm = path.match(/^\/api\/store\/checkout\/([^/]+)$/);
    if (cm) {
      const o = orders.get(cm[1]);
      return o
        ? send(200, { order_id: cm[1], state: o.state, buyer_id: o.buyer_id, amount_credits: o.amount_credits })
        : send(404, { error: "unknown order" });
    }
    const am = path.match(/^\/api\/store\/orders\/([^/]+)\/(accept-external|pay)$/);
    if (am) {
      const o = orders.get(am[1]);
      if (!o) return send(404, { error: "unknown order" });
      if (am[2] === "pay") {
        o.state = "fulfilling";
        o.buyer_id = body?.buyer_id ?? null;
        return send(200, { ok: true });
      }
      o.state = "completed";
      o.settled_to = o.seller_id;
      return send(200, { ok: true });
    }
    if (path === "/__state") {
      return send(200, {
        registry: Object.fromEntries(registry),
        products: Object.fromEntries(products),
        orders: Object.fromEntries(orders),
      });
    }
    return send(200, { ok: true });
  })
  .listen(4599, () => console.log("fake AgentPlanet/ACN on :4599"));
