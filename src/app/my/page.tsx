"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

interface MyProject {
  id: string;
  name: string;
  clientName: string | null;
  agentName: string | null;
  coverUrl: string | null;
  currentStage: string;
  shareToken: string;
  updatedAt: string;
}

// 我的项目:登录用户名下的项目列表
export default function MyProjectsPage() {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const pathname = usePathname();
  const { t, fmtDate } = useT();
  const [projects, setProjects] = useState<MyProject[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/user/projects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch {
        setProjects([]);
      }
    })();
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-50">{t("my.title")}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t("my.subtitle")}</p>

      {isLoading ? null : !isAuthenticated ? (
        <div className="mt-12 rounded-2xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-400">{t("my.loginPrompt")}</p>
          <button
            onClick={() => loginWithRedirect({ appState: { returnTo: pathname || "/my" } })}
            className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
          >
            {t("nav.login")}
          </button>
        </div>
      ) : projects === null ? (
        <div className="mt-12 text-center text-sm text-zinc-600">…</div>
      ) : projects.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center text-sm text-zinc-500">
          {t("my.empty")}
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/p/${p.shareToken}`}
                className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 transition-colors hover:border-zinc-700"
              >
                {p.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.coverUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-zinc-100">{p.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {t("common.updatedAt", { date: fmtDate(p.updatedAt) })}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {t(`stage.${p.currentStage}` as MessageKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
