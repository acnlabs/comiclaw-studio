"use client";

import { useT } from "@/components/LocaleProvider";
import MyProjects from "@/components/MyProjects";
import StudioCreatePanel from "@/components/studio/StudioCreatePanel";

/**
 * Studio is one workbench: 短视频 / 漫剧 / 专栏 share the same project list.
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
    </div>
  );
}
