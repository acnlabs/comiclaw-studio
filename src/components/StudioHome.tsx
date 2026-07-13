"use client";

import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import MyProjects from "@/components/MyProjects";
import AdminLogin from "@/components/AdminLogin";

// Studio 首页(非管理员):
// - 登录客户 → 我的项目
// - 未登录 → 品牌介绍 + 客户登录 + 运营方入口(折叠)
export default function StudioHome() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const pathname = usePathname();
  const { t } = useT();

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-zinc-600">…</div>;
  }

  if (isAuthenticated) {
    return <MyProjects />;
  }

  return (
    <>
      <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-8">
        <p className="text-sm text-zinc-300">{t("studio.useLink")}</p>
        <p className="mt-2 font-mono text-sm text-accent">{t("studio.linkExample")}</p>
        <p className="mt-4 text-xs text-zinc-500">{t("studio.linkPrivacy")}</p>
        <button
          onClick={() => loginWithRedirect({ appState: { returnTo: pathname || "/studio" } })}
          className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
        >
          {t("my.loginPrompt")}
        </button>
      </div>

      <details className="mt-10">
        <summary className="cursor-pointer text-xs text-zinc-600 transition-colors hover:text-zinc-400">
          {t("studio.operatorEntry")}
        </summary>
        <AdminLogin />
      </details>
    </>
  );
}
