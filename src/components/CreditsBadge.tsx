"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

// AgentPlanet API(浏览器直连;CORS 已放行 Studio 域,token 与 audience 同源)
const API_BASE =
  process.env.NEXT_PUBLIC_AGENTPLANET_API_URL ?? "https://api.agentplanet.org";

// 其他组件(如支付确认成功后)可派发此事件让余额立即刷新
export const CREDITS_REFRESH_EVENT = "credits:refresh";

export function requestCreditsRefresh() {
  window.dispatchEvent(new Event(CREDITS_REFRESH_EVENT));
}

// 顶栏 Credits 余额:登录后显示,窗口重获焦点(如从 AgentPlanet 充值/付款回来)
// 与收到刷新事件时自动更新。拉取失败时静默隐藏,不影响导航。
export default function CreditsBadge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`${API_BASE}/api/users/me/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.balance === "number") setBalance(data.balance);
    } catch {
      // 静默:余额是辅助信息,拉不到不打扰用户
    }
  }, [getAccessTokenSilently]);

  useEffect(() => {
    if (!isAuthenticated) return;
    queueMicrotask(() => void refresh());
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(CREDITS_REFRESH_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CREDITS_REFRESH_EVENT, refresh);
    };
  }, [isAuthenticated, refresh]);

  if (!isAuthenticated || balance === null) return null;

  return (
    <span
      title={t("nav.creditsTitle")}
      className="flex items-center gap-1 rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300"
    >
      <span className="text-accent">◈</span>
      {balance.toLocaleString()}
    </span>
  );
}
