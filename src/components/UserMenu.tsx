"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";

export default function UserMenu() {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout } = useAuth0();
  const pathname = usePathname();
  const { t } = useT();

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
      <Link
        href="/my"
        className={`text-sm font-medium transition-colors ${
          pathname === "/my" ? "text-accent" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {t("nav.myProjects")}
      </Link>
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
