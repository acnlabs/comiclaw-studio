"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import type { CreditRow } from "@/lib/workCredit";

const VISIBLE = 3;

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

  const extra = Math.max(0, credits.length - VISIBLE);
  const shown = extra > 0 ? credits.slice(0, VISIBLE) : credits;

  return (
    <div className={className}>
      <span className="inline-flex max-w-full items-center text-xs text-zinc-200">
        {shown.map((row, index) => (
          <span key={row.agentId} className="inline-flex items-center">
            {index > 0 ? <span className="text-zinc-500"> · </span> : null}
            <Link href={row.href} className="hover:text-accent">
              {row.displayName}
            </Link>
          </span>
        ))}
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("feed.castOpenList", { n: credits.length })}
          className="ml-0.5 inline-flex items-center gap-0.5 text-zinc-400 hover:text-zinc-200"
        >
          {extra > 0 ? t("feed.castExtra", { n: extra }) : null}
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
        </button>
      </span>
    </div>
  );
}
