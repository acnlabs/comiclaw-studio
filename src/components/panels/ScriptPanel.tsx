"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ScriptVersionData } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { VersionPills, EmptyState } from "@/components/ui";

export default function ScriptPanel({ versions }: { versions: ScriptVersionData[] }) {
  const [selected, setSelected] = useState(versions[0]?.version ?? 1);
  const current = versions.find((v) => v.version === selected) ?? versions[0];

  if (!current) return <EmptyState text="剧本尚未产出" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            {current.title ?? "剧本"}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              V{current.version} · {fmtDate(current.createdAt)}
            </span>
          </h2>
          {current.logline && (
            <p className="mt-1 text-sm text-zinc-400">{current.logline}</p>
          )}
        </div>
        <VersionPills
          versions={versions.map((v) => v.version)}
          selected={current.version}
          onSelect={setSelected}
        />
      </div>

      {current.changeLog && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
          本版改动:{current.changeLog}
        </div>
      )}

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-5 leading-relaxed [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-l-2 [&_h2]:border-accent [&_h2]:pl-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-accent [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_p]:my-2 [&_p]:text-sm [&_p]:text-zinc-300 [&_li]:my-1 [&_li]:text-sm [&_li]:text-zinc-300 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-zinc-100 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400">
        <ReactMarkdown>{current.content}</ReactMarkdown>
      </article>
    </div>
  );
}
