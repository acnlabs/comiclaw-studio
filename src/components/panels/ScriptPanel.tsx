"use client";

import { useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { ScriptVersionData } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { VersionPills, EmptyState } from "@/components/ui";

// 从 markdown 提取二级标题作为章节目录(长剧本跳转导航)
function extractSections(content: string): string[] {
  return content
    .split("\n")
    .filter((l) => /^##\s+/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim());
}

export default function ScriptPanel({ versions }: { versions: ScriptVersionData[] }) {
  const { t, fmtDate } = useT();
  const [selected, setSelected] = useState(versions[0]?.version ?? 1);
  const current = versions.find((v) => v.version === selected) ?? versions[0];

  const sections = useMemo(
    () => (current ? extractSections(current.content) : []),
    [current]
  );

  // 给渲染出的 h2 按出现顺序编 id,供目录跳转
  const mdComponents = useMemo<Components>(() => {
    let idx = 0;
    return {
      h2: ({ children }) => <h2 id={`sec-${idx++}`}>{children}</h2>,
    };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return <EmptyState text={t("panel.script.empty")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            {current.title ?? t("panel.script.defaultTitle")}
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
          {t("panel.script.changeLog", { text: current.changeLog })}
        </div>
      )}

      {sections.length >= 4 && (
        <nav className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
          <span className="mr-1 text-xs text-zinc-500">{t("script.toc")}</span>
          {sections.map((title, i) => (
            <button
              key={i}
              onClick={() =>
                document
                  .getElementById(`sec-${i}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            >
              {title.length > 16 ? title.slice(0, 16) + "…" : title}
            </button>
          ))}
        </nav>
      )}

      <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-5 leading-relaxed [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-l-2 [&_h2]:border-accent [&_h2]:pl-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-accent [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_p]:my-2 [&_p]:text-sm [&_p]:text-zinc-300 [&_li]:my-1 [&_li]:text-sm [&_li]:text-zinc-300 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-zinc-100 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400">
        <ReactMarkdown components={mdComponents}>{current.content}</ReactMarkdown>
      </article>
    </div>
  );
}
