"use client";

import { useState } from "react";
import type { FilmVersionData } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { fmtDate, fmtDuration } from "@/lib/format";
import { VersionPills, EmptyState } from "@/components/ui";

export default function FilmPanel({ versions }: { versions: FilmVersionData[] }) {
  const { t } = useT();
  const [selected, setSelected] = useState(versions[0]?.version ?? 1);
  const current = versions.find((v) => v.version === selected) ?? versions[0];

  if (!current) return <EmptyState text={t("panel.film.empty")} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">
          {t("panel.film.title")}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            V{current.version} · {fmtDate(current.createdAt)}
            {current.duration != null && <> · {fmtDuration(current.duration)}</>}
          </span>
        </h2>
        <VersionPills
          versions={versions.map((v) => v.version)}
          selected={current.version}
          onSelect={setSelected}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <video
          key={current.id}
          src={current.videoUrl}
          controls
          playsInline
          className="aspect-video w-full"
        />
      </div>

      {current.notes && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
          {t("panel.film.notes", { text: current.notes })}
        </div>
      )}
    </div>
  );
}
