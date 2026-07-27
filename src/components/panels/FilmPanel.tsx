"use client";

import { useMemo, useRef, useState } from "react";
import type { FilmVersionData } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { fmtDuration } from "@/lib/format";
import { VersionPills, EmptyState } from "@/components/ui";
import CommentSection from "@/components/panels/CommentSection";

function authorTag(authorKey?: string | null): string {
  if (!authorKey || authorKey === "legacy") return "";
  if (authorKey.startsWith("user:")) return "user";
  if (authorKey.startsWith("agent:")) return "agent";
  return authorKey.slice(0, 8);
}

export default function FilmPanel({
  versions,
  shareToken,
}: {
  versions: FilmVersionData[];
  shareToken: string;
}) {
  const { t, fmtDate } = useT();
  const [selectedId, setSelectedId] = useState(versions[0]?.id ?? "");
  const [compareWithId, setCompareWithId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const compareRef = useRef<HTMLVideoElement | null>(null);

  const current = versions.find((v) => v.id === selectedId) ?? versions[0];
  const compare =
    compareWithId != null ? versions.find((v) => v.id === compareWithId) ?? null : null;

  const multiAuthor = useMemo(() => {
    const keys = new Set(versions.map((v) => v.authorKey ?? "legacy"));
    return keys.size > 1;
  }, [versions]);

  if (!current) return <EmptyState text={t("panel.film.empty")} />;

  const otherVersions = versions.filter((v) => v.id !== current.id);
  const tag = authorTag(current.authorKey);

  const pill = (v: FilmVersionData) => {
    const a = authorTag(v.authorKey);
    return {
      id: v.id,
      label: multiAuthor && a ? `V${v.version} · ${a}` : `V${v.version}`,
    };
  };

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
            V{current.version}
            {tag ? ` · ${tag}` : ""} · {fmtDate(current.createdAt)}
            {current.duration != null && <> · {fmtDuration(current.duration)}</>}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <VersionPills
            versions={versions.map(pill)}
            selected={current.id}
            onSelect={(id) => {
              const next = String(id);
              setSelectedId(next);
              if (next === compareWithId) setCompareWithId(null);
            }}
          />
          {otherVersions.length > 0 && (
            <button
              onClick={() =>
                setCompareWithId(compare ? null : otherVersions[0].id)
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
                  V{v.version}
                  {authorTag(v.authorKey) ? ` · ${authorTag(v.authorKey)}` : ""} ·{" "}
                  {fmtDate(v.createdAt)}
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
                versions={otherVersions.map(pill)}
                selected={compare.id}
                onSelect={(id) => setCompareWithId(String(id))}
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
