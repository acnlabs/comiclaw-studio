"use client";

import { useT } from "@/components/LocaleProvider";
import type { CreditRow } from "@/lib/workCredit";

export default function FeedCastLine({
  credits,
  onOpen,
  className,
}: {
  credits: CreditRow[];
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
      <span className="flex min-w-0 items-center gap-1.5 text-xs">
        <span className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain whitespace-nowrap text-zinc-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {credits.map((row, index) => (
            <span key={row.agentId}>
              {index > 0 ? <span className="text-zinc-500"> · </span> : null}
              {row.displayName}
            </span>
          ))}
        </span>
        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3 shrink-0 text-zinc-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </span>
    </button>
  );
}
