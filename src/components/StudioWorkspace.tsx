"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectData, StageKey } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import PipelineHeader from "@/components/PipelineHeader";
import ScriptPanel from "@/components/panels/ScriptPanel";
import AssetsPanel from "@/components/panels/AssetsPanel";
import StoryboardPanel from "@/components/panels/StoryboardPanel";
import FilmPanel from "@/components/panels/FilmPanel";
import ReleasePanel from "@/components/panels/ReleasePanel";

type TabKey = Exclude<StageKey, "DONE">;

const TABS: { key: TabKey }[] = [
  { key: "SCRIPT" },
  { key: "ASSETS" },
  { key: "STORYBOARD" },
  { key: "FILM" },
  { key: "RELEASE" },
];

export default function StudioWorkspace({ project }: { project: ProjectData }) {
  const { t, fmtDate } = useT();
  const initialTab: TabKey =
    project.currentStage === "DONE" ? "RELEASE" : (project.currentStage as TabKey);
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : "SCRIPT"
  );

  const countOf: Record<TabKey, number> = {
    SCRIPT: project.scriptVersions.length,
    ASSETS: project.assets.length,
    STORYBOARD: project.shots.length,
    FILM: project.filmVersions.length,
    RELEASE: project.releases.length,
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
      {/* 头部 */}
      <header className="border-b border-zinc-800/80 py-6">
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 text-xs tracking-widest text-accent transition-opacity hover:opacity-80"
          title="返回 Studio"
        >
          COMICLAW STUDIO
          <span className="text-zinc-600">{t("studio.brandSub")}</span>
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-50 sm:text-3xl">{project.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {project.clientName && (
            <span>
              {t("common.client")}:{project.clientName}
            </span>
          )}
          {project.agentName && (
            <span>
              {t("common.agent")}:{project.agentName}
            </span>
          )}
          <span>{t("common.updatedAt", { date: fmtDate(project.updatedAt) })}</span>
        </div>
        {project.description && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {project.description}
          </p>
        )}
        <div className="mt-4">
          <PipelineHeader currentStage={project.currentStage} />
        </div>
      </header>

      {/* Tab 导航 */}
      <nav className="sticky top-12 z-10 -mx-4 border-b border-zinc-800/80 bg-[#0b0b10]/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
                tab === item.key ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t(`stage.${item.key}` as MessageKey)}
              {countOf[item.key] > 0 && (
                <span className="ml-1.5 text-xs text-zinc-600">{countOf[item.key]}</span>
              )}
              {tab === item.key && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* 内容 */}
      <main className="pt-6">
        {tab === "SCRIPT" && <ScriptPanel versions={project.scriptVersions} />}
        {tab === "ASSETS" && <AssetsPanel assets={project.assets} />}
        {tab === "STORYBOARD" && <StoryboardPanel shots={project.shots} />}
        {tab === "FILM" && (
          <FilmPanel versions={project.filmVersions} shareToken={project.shareToken} />
        )}
        {tab === "RELEASE" && <ReleasePanel releases={project.releases} />}
      </main>
    </div>
  );
}
