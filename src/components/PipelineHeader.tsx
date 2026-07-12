"use client";

import { STAGES, type StageKey } from "@/lib/types";

// 五阶段流水线:已完成(实心)、进行中(高亮)、未开始(灰)
export default function PipelineHeader({ currentStage }: { currentStage: string }) {
  const currentIdx =
    currentStage === "DONE"
      ? STAGES.length
      : STAGES.findIndex((s) => s.key === (currentStage as StageKey));

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 sm:gap-2">
      {STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={stage.key} className="flex shrink-0 items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div className={`h-px w-4 sm:w-8 ${done || active ? "bg-accent/60" : "bg-zinc-800"}`} />
            )}
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                active
                  ? "border-accent/60 bg-accent/10"
                  : done
                    ? "border-zinc-700 bg-zinc-900"
                    : "border-zinc-800 bg-transparent"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-accent text-zinc-950"
                    : active
                      ? "border border-accent text-accent"
                      : "border border-zinc-700 text-zinc-600"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-sm font-medium ${
                  active ? "text-accent" : done ? "text-zinc-300" : "text-zinc-600"
                }`}
              >
                {stage.label}
              </span>
              <span className="hidden text-xs text-zinc-600 md:inline">{stage.hint}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
