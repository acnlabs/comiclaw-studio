"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  visibility?: string;
  updatedAt: string;
}

// 登录客户的项目列表(嵌入 Studio 页)
// bare: 由外层标签页给标题时,省掉组件内的标题块
export default function MyProjects({ bare }: { bare?: boolean }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t, fmtDate } = useT();
  const [projects, setProjects] = useState<MyProject[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const res = await fetch("/api/user/projects", { headers });
          const data = await res.json();
          setProjects(data.projects ?? []);
        } catch {
          setProjects([]);
        }
      } catch {
        setProjects([]);
      }
    })();
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  return (
    <div>
      {bare ? (
        <p className="mb-4 text-sm text-zinc-500">{t("my.subtitle")}</p>
      ) : (
        <>
          <h2 className="mt-12 mb-1 text-lg font-semibold text-zinc-100">
            {t("my.title")}
          </h2>
          <p className="mb-4 text-sm text-zinc-500">{t("my.subtitle")}</p>
        </>
      )}
      {projects === null ? (
        <div className="py-10 text-center text-sm text-zinc-600">…</div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center text-sm text-zinc-500">
          {t("my.empty")}
        </div>
      ) : (
        <ul className="space-y-3">
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
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium text-zinc-100">{p.name}</div>
                    {p.visibility === "PUBLIC" ? (
                      <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        {t("studioCreate.kindCocreate")}
                      </span>
                    ) : null}
                  </div>
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
