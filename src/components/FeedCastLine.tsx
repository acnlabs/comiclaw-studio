"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import type { AppearanceCredit } from "@/lib/workAppearance";

export default function FeedCastLine({
  visible,
  extra,
  className,
}: {
  visible: AppearanceCredit[];
  extra: number;
  className?: string;
}) {
  const { t } = useT();
  if (visible.length === 0) return null;
  return (
    <p className={className}>
      <span className="text-zinc-400">{t("feed.castPrefix")} </span>
      {visible.map((row, i) => (
        <span key={row.agentId}>
          {i > 0 && <span className="text-zinc-500"> · </span>}
          <Link href={row.href} className="pointer-events-auto hover:text-accent">
            {row.displayName}
          </Link>
        </span>
      ))}
      {extra > 0 ? <span className="text-zinc-500">{t("feed.castExtra", { n: extra })}</span> : null}
    </p>
  );
}
