"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import MyProjects from "@/components/MyProjects";
import MyCharacters from "@/components/MyCharacters";
import MyColumnsPanel from "@/components/studio/MyColumnsPanel";
import StudioCreatePanel from "@/components/studio/StudioCreatePanel";

type Tab = "projects" | "columns" | "characters";

/**
 * Projects, columns and characters are separate workspaces, not one long
 * scroll — each tab keeps its own list and empty state.
 */
export default function StudioTabs() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("projects");

  const tabs: { id: Tab; label: string }[] = [
    { id: "projects", label: t("my.title") },
    { id: "columns", label: t("myColumns.title") },
    { id: "characters", label: t("myChar.title") },
  ];

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-zinc-800/80 p-0.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-accent text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <StudioCreatePanel />
      </div>

      <div className="mt-6">
        {tab === "projects" ? <MyProjects bare /> : null}
        {tab === "columns" ? <MyColumnsPanel bare /> : null}
        {tab === "characters" ? <MyCharacters bare /> : null}
      </div>
    </div>
  );
}
