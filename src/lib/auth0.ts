// Auth0 配置(与 AgentPlanet 同租户,Studio 为独立 SPA 应用)
// 这些值是 SPA 公开配置,可通过环境变量覆盖
export const AUTH0_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "dev-ypufda63738rkary.us.auth0.com";

export const AUTH0_CLIENT_ID =
  process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "QLV1xUDPecgw9mqYlViaw2OZ8DzeEGGI";

export const AUTH0_AUDIENCE =
  process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "https://api.agentplanet.org";
