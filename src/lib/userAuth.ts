import { createRemoteJWKSet, jwtVerify } from "jose";
import { AUTH0_DOMAIN, AUTH0_AUDIENCE } from "@/lib/auth0";

// 服务端验证用户的 Auth0 Access Token(RS256 + JWKS 离线验签)
// 返回用户标识 sub(如 auth0|xxx),验证失败返回 null
const jwks = createRemoteJWKSet(
  new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`)
);

export async function verifyUserToken(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
