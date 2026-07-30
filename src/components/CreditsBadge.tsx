"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

// AgentPlanet API(浏览器直连;CORS 已放行 Studio 域,token 与 audience 同源)
const API_BASE =
  process.env.NEXT_PUBLIC_AGENTPLANET_API_URL ?? "https://api.agentplanet.org";

// AgentPlanet 钱包页(充值入口);窗口焦点检测会在用户充值回来后自动刷新余额
export const WALLET_URL =
  process.env.NEXT_PUBLIC_AGENTPLANET_WALLET_URL ?? "https://agentplanet.org/wallet";

// 其他组件(如支付确认成功后)可派发此事件让余额立即刷新
export const CREDITS_REFRESH_EVENT = "credits:refresh";

export function requestCreditsRefresh() {
  window.dispatchEvent(new Event(CREDITS_REFRESH_EVENT));
}

// 顶栏 Credits 余额:登录后显示,窗口重获焦点(如从 AgentPlanet 充值/付款回来)
// 与收到刷新事件时自动更新。点进站内收支页(归因明细),再从那里去 AgentPlanet
// 钱包看总账;余额拉不到时只藏数字,入口仍在,否则收支页就没有导航入口了。
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

  if (!isAuthenticated) return null;

  return (
    <Link
      href="/credits"
      title={t("nav.creditsTitle")}
      className="flex items-center gap-1 rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
    >
      <span className="text-accent">◈</span>
      {balance === null ? t("nav.credits") : balance.toLocaleString()}
    </Link>
  );
}
