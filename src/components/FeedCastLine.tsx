"use client";

import { useT } from "@/components/LocaleProvider";
import type { AppearanceCredit } from "@/lib/workAppearance";

export default function FeedCastLine({
  credits,
  onOpen,
  className,
}: {
  credits: AppearanceCredit[];
  onOpen: () => void;
  className?: string;
}) {
  const { t } = useT();
  if (credits.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("feed.castOpenList", { n: credits.length })}
      className={className}
    >
      <span className="flex items-center gap-1.5">
        <span className="shrink-0 text-xs text-zinc-400">{t("feed.castPrefix")}</span>
        <span className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="inline-flex items-center gap-1.5 pr-1">
            {credits.map((row) => (
              <span
                key={row.agentId}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-zinc-950/60 px-2.5 py-1 text-xs text-zinc-100"
              >
                {row.displayName}
                {row.role === "lead" ? (
                  <span className="text-[10px] text-zinc-400">{t("series.castLead")}</span>
                ) : null}
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}
