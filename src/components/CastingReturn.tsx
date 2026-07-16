"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { requestCreditsRefresh } from "@/components/CreditsBadge";

type ConfirmState = "checking" | "success" | "notPaid" | "dead" | "error";

// 支付跳转回调落地页:AgentPlanet checkout 支付成功后(若其前端支持 return_url)
// 会把浏览器带到这里,自动完成授权确认,免去客户手动切回 Studio 点确认。
// 即使 AgentPlanet 暂未实现跳转,这个页面本身独立可用(直接访问也能手动重试确认)。
export default function CastingReturn({
  characterId,
  projectId,
}: {
  characterId: string;
  projectId: string;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const { t } = useT();
  const [confirmState, setConfirmState] = useState<ConfirmState>("checking");
  const attempted = useRef(false);

  const confirm = useCallback(async () => {
    setConfirmState("checking");
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch("/api/user/casting/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ characterId, projectId }),
      });
      if (res.ok) {
        setConfirmState("success");
        requestCreditsRefresh(); // 刚扣了 Credits,顶栏余额立即刷新
      } else if (res.status === 402) setConfirmState("notPaid");
      else if (res.status === 409) setConfirmState("dead");
      else setConfirmState("error");
    } catch {
      setConfirmState("error");
    }
  }, [getAccessTokenSilently, characterId, projectId]);

  // 只在已登录时触发确认;未登录/加载中的展示由渲染时直接派生,不经 state,
  // 避免在 effect 里为这两种情况调用 setState。
  useEffect(() => {
    if (isLoading || !isAuthenticated || attempted.current) return;
    attempted.current = true;
    confirm();
  }, [isLoading, isAuthenticated, confirm]);

  if (isLoading) {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">{t("castingReturn.checking")}</h1>
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">{t("castingReturn.needLogin")}</h1>
        <button
          onClick={() =>
            loginWithRedirect({
              appState: { returnTo: `/casting/return?characterId=${characterId}&projectId=${projectId}` },
            })
          }
          className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
        >
          {t("claim.login")}
        </button>
      </Shell>
    );
  }

  if (confirmState === "checking") {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">{t("castingReturn.checking")}</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{t("castingReturn.checkingHint")}</p>
      </Shell>
    );
  }

  if (confirmState === "success") {
    return (
      <Shell>
        <div className="mt-4 text-3xl">✓</div>
        <h1 className="mt-2 text-2xl font-bold text-zinc-50">{t("castingReturn.success")}</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{t("castingReturn.successHint")}</p>
        <Link
          href="/studio"
          className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
        >
          {t("castingReturn.goToStudio")}
        </Link>
      </Shell>
    );
  }

  if (confirmState === "notPaid") {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">{t("castingReturn.notPaid")}</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{t("casting.notPaid")}</p>
        <button
          onClick={confirm}
          className="mt-6 rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          {t("castingReturn.retry")}
        </button>
      </Shell>
    );
  }

  // dead | error
  return (
    <Shell>
      <h1 className="mt-4 text-2xl font-bold text-zinc-50">{t("castingReturn.failed")}</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        {confirmState === "dead" ? t("casting.orderDead") : t("castingReturn.failedHint")}
      </p>
      <Link
        href="/characters"
        className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
      >
        {t("castingReturn.backToCast")}
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="text-xs tracking-widest text-accent">COMICLAW STUDIO</div>
      {children}
    </div>
  );
}
