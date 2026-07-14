"use client";

import { useRef, useState } from "react";
import type { FilmVersionData } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { fmtDuration } from "@/lib/format";
import { VersionPills, EmptyState } from "@/components/ui";
import CommentSection from "@/components/panels/CommentSection";

export default function FilmPanel({
  versions,
  shareToken,
}: {
  versions: FilmVersionData[];
  shareToken: string;
}) {
  const { t, fmtDate } = useT();
  const [selected, setSelected] = useState(versions[0]?.version ?? 1);
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const compareRef = useRef<HTMLVideoElement | null>(null);

  const current = versions.find((v) => v.version === selected) ?? versions[0];
  const compare = compareWith != null ? versions.find((v) => v.version === compareWith) : null;

  if (!current) return <EmptyState text={t("panel.film.empty")} />;

  const otherVersions = versions.filter((v) => v.version !== current.version);

  const playBoth = () => {
    for (const ref of [videoRef, compareRef]) {
      const v = ref.current;
      if (v) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    }
  };

  return (
    <div className={`mx-auto space-y-4 ${compare ? "max-w-6xl" : "max-w-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">
          {t("panel.film.title")}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            V{current.version} · {fmtDate(current.createdAt)}
            {current.duration != null && <> · {fmtDuration(current.duration)}</>}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <VersionPills
            versions={versions.map((v) => v.version)}
            selected={current.version}
            onSelect={(v) => {
              setSelected(v);
              if (v === compareWith) setCompareWith(null);
            }}
          />
          {otherVersions.length > 0 && (
            <button
              onClick={() =>
                setCompareWith(compare ? null : otherVersions[0].version)
              }
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                compare
                  ? "bg-accent text-zinc-950"
                  : "border border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {compare ? t("film.compareOff") : t("film.compare")}
            </button>
          )}
        </div>
      </div>

      {compare ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {[
              { v: current, ref: videoRef },
              { v: compare, ref: compareRef },
            ].map(({ v, ref }) => (
              <div key={v.id}>
                <p className="mb-1.5 text-xs text-zinc-500">
                  V{v.version} · {fmtDate(v.createdAt)}
                </p>
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                  <video ref={ref} src={v.videoUrl} controls playsInline className="aspect-video w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={playBoth}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
            >
              ▶ {t("film.playBoth")}
            </button>
            {otherVersions.length > 1 && (
              <VersionPills
                versions={otherVersions.map((v) => v.version)}
                selected={compare.version}
                onSelect={setCompareWith}
              />
            )}
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <video
            key={current.id}
            ref={videoRef}
            src={current.videoUrl}
            controls
            playsInline
            className="aspect-video w-full"
          />
        </div>
      )}

      {current.notes && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
          {t("panel.film.notes", { text: current.notes })}
        </div>
      )}

      <CommentSection
        shareToken={shareToken}
        filmVersionId={current.id}
        comments={current.comments ?? []}
        videoRef={videoRef}
      />
    </div>
  );
}
