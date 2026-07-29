"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";
import MyProjects from "@/components/MyProjects";
import MyCharacters from "@/components/MyCharacters";
import MyColumnsPanel from "@/components/studio/MyColumnsPanel";
import StudioCreatePanel from "@/components/studio/StudioCreatePanel";

type Tab = "projects" | "columns" | "characters";

const ORDER: Tab[] = ["projects", "columns", "characters"];

/**
 * Projects, columns and characters are separate workspaces, not one long
 * scroll — each tab keeps its own list and empty state.
 */
export default function StudioTabs() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("projects");
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const labels: Record<Tab, string> = {
    projects: t("my.title"),
    columns: t("myColumns.title"),
    characters: t("myChar.title"),
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next =
      ORDER[(ORDER.indexOf(tab) + delta + ORDER.length) % ORDER.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={t("studio.title")}
          onKeyDown={onKeyDown}
          className="inline-flex rounded-full bg-zinc-800/80 p-0.5"
        >
          {ORDER.map((id) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`studio-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`studio-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-accent text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {labels[id]}
            </button>
          ))}
        </div>
        <StudioCreatePanel />
      </div>

      <div
        role="tabpanel"
        id={`studio-panel-${tab}`}
        aria-labelledby={`studio-tab-${tab}`}
        className="mt-6"
      >
        {tab === "projects" ? <MyProjects bare /> : null}
        {tab === "columns" ? <MyColumnsPanel bare /> : null}
        {tab === "characters" ? <MyCharacters bare /> : null}
      </div>
    </div>
  );
}
