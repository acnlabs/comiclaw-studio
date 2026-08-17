"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import CreditsBadge from "@/components/CreditsBadge";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

type YoutubeStatus = {
  configured: boolean;
  connected: boolean;
  channelTitle: string | null;
};

export default function UserMenu() {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout, getAccessTokenSilently } =
    useAuth0();
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileHref, setProfileHref] = useState<string | null>(null);
  const [youtube, setYoutube] = useState<YoutubeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const headers = { Authorization: `Bearer ${token}` };
        const [me, yt] = await Promise.all([
          fetch("/api/user/profile", { headers }),
          fetch("/api/user/youtube", { headers }),
        ]);
        const mine = (await me.json().catch(() => null)) as {
          profile?: { href?: string };
        } | null;
        const tube = (await yt.json().catch(() => null)) as YoutubeStatus | null;
        if (cancelled) return;
        if (me.ok && mine?.profile?.href) setProfileHref(mine.profile.href);
        if (yt.ok && tube) {
          setYoutube({
            configured: Boolean(tube.configured),
            connected: Boolean(tube.connected),
            channelTitle: tube.channelTitle ?? null,
          });
        }
      } catch {
        // 菜单里缺这两项不挡登录态
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

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

  const authHeaders = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    });
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const copyAccountId = async () => {
    if (!user?.sub) return;
    try {
      await navigator.clipboard.writeText(user.sub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt(t("nav.accountId"), user.sub);
    }
  };

  const connectYoutube = async () => {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/user/youtube/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({
          returnTo: pathname.startsWith("/p/") || pathname.startsWith("/studio")
            ? pathname
            : "/studio",
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        authorizeUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.authorizeUrl) {
        setError(data?.error || t("panel.youtube.error"));
        return;
      }
      window.location.href = data.authorizeUrl;
    } catch {
      setError(t("panel.youtube.error"));
    } finally {
      setBusy(false);
    }
  };

  const disconnectYoutube = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/user/youtube", { method: "DELETE", headers });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || t("panel.youtube.error"));
        return;
      }
      setYoutube((prev) =>
        prev ? { ...prev, connected: false, channelTitle: null } : prev,
      );
    } catch {
      setError(t("panel.youtube.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3" ref={rootRef}>
      <CreditsBadge />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={t("nav.accountMenu")}
          aria-label={t("nav.accountMenu")}
          aria-expanded={open}
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
        </button>
        {open ? (
          <div className="absolute top-9 right-0 z-30 w-56 rounded-xl border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                {t("my.publicProfile")}
              </Link>
            ) : null}

            {youtube?.configured === false ? (
              <p className="px-3 py-2 text-xs text-zinc-500">
                {t("panel.youtube.notConfigured")}
              </p>
            ) : youtube?.connected ? (
              <div className="px-3 py-2">
                <p className="text-sm text-zinc-200">
                  {t("nav.youtubeBound")}
                  {youtube.channelTitle ? (
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {youtube.channelTitle}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={disconnectYoutube}
                  disabled={busy}
                  className="mt-1 text-xs text-zinc-500 underline hover:text-zinc-300 disabled:opacity-50"
                >
                  {t("panel.youtube.disconnect")}
                </button>
              </div>
            ) : youtube ? (
              <button
                type="button"
                onClick={connectYoutube}
                disabled={busy}
                className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
              >
                {t("nav.bindYoutube")}
              </button>
            ) : null}

            <button
              type="button"
              onClick={copyAccountId}
              className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
            >
              {copied ? t("nav.accountIdCopied") : t("nav.copyAccountId")}
            </button>
            <button
              type="button"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              className="block w-full px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            >
              {t("nav.logout")}
            </button>
            {error ? <p className="px-3 pb-2 text-xs text-red-400">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
