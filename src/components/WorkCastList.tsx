"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import type { AppearanceCredit } from "@/lib/workAppearance";

export default function WorkCastList({ credits }: { credits: AppearanceCredit[] }) {
  const { t } = useT();
  if (credits.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-zinc-400">{t("series.cast")}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {credits.map((row) => (
          <li key={row.agentId}>
            <Link
              href={row.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-200 hover:border-zinc-600 hover:text-accent"
            >
              {row.displayName}
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {row.role === "lead" ? t("series.castLead") : t("series.castMember")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
