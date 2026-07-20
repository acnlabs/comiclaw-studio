"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_AUDIENCE } from "@/lib/auth0";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
        audience: AUTH0_AUDIENCE,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      // refresh token 失效(过期/轮换失效)时退回 iframe 静默授权,只要 Auth0
      // 会话 cookie 还在就能自动恢复,而不是让 getAccessTokenSilently 直接抛错
      useRefreshTokensFallback
      onRedirectCallback={(appState) => {
        router.replace(appState?.returnTo ?? "/");
      }}
    >
      {children}
    </Auth0Provider>
  );
}
