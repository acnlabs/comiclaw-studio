"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import type { AppearanceCredit } from "@/lib/workAppearance";

const COLLAPSED = 2;

export default function FeedCastLine({
  credits,
  active = true,
  className,
}: {
  credits: AppearanceCredit[];
  active?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);

  if (credits.length === 0) return null;

  const extra = Math.max(0, credits.length - COLLAPSED);
  const shown = open || extra === 0 ? credits : credits.slice(0, COLLAPSED);

  return (
    <div className={className}>
      <div
        className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="shrink-0 text-xs text-zinc-400">{t("feed.castPrefix")}</span>
        {shown.map((row) => (
          <Link
            key={row.agentId}
            href={row.href}
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-zinc-950/60 px-2.5 py-1 text-xs text-zinc-100 backdrop-blur hover:border-accent/70 hover:text-accent"
          >
            {row.displayName}
            {row.role === "lead" ? (
              <span className="text-[10px] text-zinc-400">{t("series.castLead")}</span>
            ) : null}
          </Link>
        ))}
        {extra > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="pointer-events-auto inline-flex shrink-0 items-center rounded-full border border-white/10 bg-zinc-950/40 px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100"
          >
            {open ? t("feed.castCollapse") : t("feed.castExtra", { n: extra })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
