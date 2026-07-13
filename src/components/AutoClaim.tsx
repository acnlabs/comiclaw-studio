"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

// 项目自动认领:
// - 已登录且项目无主 → 自动绑定到当前用户,轻提示
// - 未登录 → 显示提示条,引导登录(登录回来后自动完成绑定)
export default function AutoClaim({
  shareToken,
  hasOwner,
}: {
  shareToken: string;
  hasOwner: boolean;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const pathname = usePathname();
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (hasOwner || !isAuthenticated || isLoading || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/user/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ shareToken }),
        });
        const data = await res.json().catch(() => null);
        if (data?.claimed) {
          setSaved(true);
          setTimeout(() => setSaved(false), 5000);
        }
      } catch {
        // 静默失败:认领失败不影响查看
      }
    })();
  }, [hasOwner, isAuthenticated, isLoading, getAccessTokenSilently, shareToken]);

  if (saved) {
    return (
      <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm text-emerald-400 backdrop-blur">
        ✓ {t("claim.saved")}
      </div>
    );
  }

  if (!hasOwner && !isLoading && !isAuthenticated) {
    return (
      <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-zinc-300">
        <span>{t("claim.hint")}</span>
        <button
          onClick={() => loginWithRedirect({ appState: { returnTo: pathname || "/" } })}
          className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
        >
          {t("claim.login")}
        </button>
      </div>
    );
  }

  return null;
}
