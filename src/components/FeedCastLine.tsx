"use client";

import { useT } from "@/components/LocaleProvider";
import type { CreditRow } from "@/lib/workCredit";
import { creditLabelKeys } from "@/lib/workCreditLabels";

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
      <span className="flex min-w-0 items-baseline gap-1 text-xs">
        <span className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain whitespace-nowrap text-zinc-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {credits.map((row, index) => (
            <span key={row.agentId}>
              {index > 0 ? <span className="text-zinc-500"> · </span> : null}
              {row.displayName}
              <span className="text-zinc-500">
                {" "}
                {creditLabelKeys(row)
                  .map((key) => t(key))
                  .join("/")}
              </span>
            </span>
          ))}
        </span>
        <span className="shrink-0 text-zinc-500" aria-hidden>
          ▾
        </span>
      </span>
    </button>
  );
}
