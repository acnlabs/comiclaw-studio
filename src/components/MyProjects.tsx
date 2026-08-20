"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import ColumnOwnerTools, {
  type StudioColumn,
} from "@/components/studio/ColumnOwnerTools";

interface MyProject {
  id: string;
  name: string;
  clientName: string | null;
  agentName: string | null;
  coverUrl: string | null;
  currentStage: string;
  shareToken: string;
  visibility?: string;
  format?: string;
  episodeCount?: number;
  updatedAt: string;
}

type ListItem =
  | { kind: "project"; sortAt: number; project: MyProject }
  | { kind: "column"; sortAt: number; column: StudioColumn };

function toTime(value: string): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

// 登录客户的项目列表(嵌入 Studio 页)
// bare: 由外层标签页给标题时,省掉组件内的标题块
export default function MyProjects({ bare }: { bare?: boolean }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t, fmtDate } = useT();
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [columns, setColumns] = useState<StudioColumn[] | null>(null);
  const [openColumnId, setOpenColumnId] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    });
    return { Authorization: `Bearer ${token}` };
  }, [getAccessTokenSilently]);

  const loadLists = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [projRes, colRes] = await Promise.all([
        fetch("/api/user/projects", { headers }),
        fetch("/api/user/my-columns", { headers }),
      ]);
      const projData = (await projRes.json().catch(() => null)) as {
        projects?: MyProject[];
      } | null;
      const colData = (await colRes.json().catch(() => null)) as {
        columns?: StudioColumn[];
      } | null;
      setProjects(projData?.projects ?? []);
      setColumns(colData?.columns ?? []);
    } catch {
      setProjects([]);
      setColumns([]);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    void loadLists();
  }, [isAuthenticated, isLoading, loadLists]);

  const items: ListItem[] | null =
    projects === null || columns === null
      ? null
      : [
          ...projects.map((project) => ({
            kind: "project" as const,
            sortAt: toTime(project.updatedAt),
            project,
          })),
          ...columns.map((column) => ({
            kind: "column" as const,
            sortAt: toTime(column.updatedAt),
            column,
          })),
        ].sort((a, b) => b.sortAt - a.sortAt);

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
      {items === null ? (
        <div className="py-10 text-center text-sm text-zinc-600">…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center text-sm text-zinc-500">
          {t("my.empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) =>
            item.kind === "project" ? (
              <ProjectRow key={item.project.id} project={item.project} />
            ) : (
              <li
                key={item.column.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <Link
                    href={`/c/${item.column.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-4 transition-colors hover:opacity-90"
                  >
                    {item.column.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.column.coverUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium text-zinc-100">
                          {item.column.name}
                        </div>
                        <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                          {t("studioCreate.formatColumn")}
                        </span>
                        {item.column.contributePolicy !== "owner_only" ? (
                          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                            {t("studioCreate.kindCocreate")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {t("common.updatedAt", {
                          date: fmtDate(item.column.updatedAt),
                        })}
                      </div>
                    </div>
                  </Link>
                  <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {t("column.issues", { n: item.column.issueCount })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenColumnId((id) =>
                        id === item.column.id ? null : item.column.id
                      )
                    }
                    className="relative shrink-0 rounded-full border border-zinc-600 px-3.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-400 hover:text-zinc-100"
                  >
                    {openColumnId === item.column.id
                      ? t("myColumns.close")
                      : t("myColumns.manage")}
                    {item.column.pendingJoinRequests > 0 &&
                    openColumnId !== item.column.id ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-zinc-950">
                        {item.column.pendingJoinRequests}
                      </span>
                    ) : null}
                  </button>
                </div>
                {openColumnId === item.column.id ? (
                  <ColumnOwnerTools
                    column={item.column}
                    onChanged={(event) => {
                      if (event?.deleted) setOpenColumnId(null);
                      void loadLists();
                    }}
                  />
                ) : null}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function ProjectRow({ project: p }: { project: MyProject }) {
  const { t, fmtDate } = useT();
  return (
    <li>
      <Link
        href={`/p/${p.shareToken}`}
        className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 transition-colors hover:border-zinc-700"
      >
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.coverUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-medium text-zinc-100">{p.name}</div>
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {p.format === "DRAMA"
                ? t("studioCreate.formatDrama")
                : t("studioCreate.formatVideo")}
            </span>
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
          {p.format === "DRAMA"
            ? t("common.episodes", { n: p.episodeCount ?? 0 })
            : t(`stage.${p.currentStage}` as MessageKey)}
        </span>
      </Link>
    </li>
  );
}
