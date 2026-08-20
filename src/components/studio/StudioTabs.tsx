"use client";

import { useT } from "@/components/LocaleProvider";
import MyProjects from "@/components/MyProjects";
import MyColumnsPanel from "@/components/studio/MyColumnsPanel";
import StudioCreatePanel from "@/components/studio/StudioCreatePanel";

/**
 * Studio is the workbench: 短视频 / 漫剧 are projects; 专栏 still maps to a column.
 */
export default function StudioTabs() {
  const { t } = useT();

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-300">{t("my.title")}</h2>
        <StudioCreatePanel />
      </div>
      <div className="mt-6">
        <MyProjects bare />
      </div>
      <div className="mt-12">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">{t("myColumns.title")}</h2>
        <MyColumnsPanel bare />
      </div>
    </div>
  );
}
