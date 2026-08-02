"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import CreditsBadge from "@/components/CreditsBadge";

export default function UserMenu() {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout } = useAuth0();
  const pathname = usePathname();
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <button
        onClick={() =>
          loginWithRedirect({ appState: { returnTo: pathname || "/" } })
        }
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
      >
        {t("nav.login")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <CreditsBadge />
      {/* 账号 ID 是「这个栏目/项目归谁」在系统里的写法,运维认领、对账都要用它。
          此前它在界面上无处可见,只能去浏览器缓存里翻——点头像即可复制。 */}
      <button
        type="button"
        onClick={async () => {
          if (!user?.sub) return;
          try {
            await navigator.clipboard.writeText(user.sub);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            // 剪贴板被拒时至少让它可见,用户能自己选中复制
            window.prompt(t("nav.accountId"), user.sub);
          }
        }}
        title={user?.sub ? `${t("nav.copyAccountId")} · ${user.sub}` : undefined}
        aria-label={t("nav.copyAccountId")}
        className="relative rounded-full transition-opacity hover:opacity-80"
      >
        {user?.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt={user.name ?? "avatar"}
            className="h-7 w-7 rounded-full border border-zinc-700"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        {copied ? (
          <span className="absolute top-9 right-0 z-30 rounded-md bg-zinc-800 px-2 py-1 text-[11px] whitespace-nowrap text-zinc-200 shadow-lg">
            {t("nav.accountIdCopied")}
          </span>
        ) : null}
      </button>
      <button
        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        title={t("nav.logout")}
      >
        {t("nav.logout")}
      </button>
    </div>
  );
}
