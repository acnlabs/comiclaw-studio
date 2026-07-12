"use client";

import type { ReleaseData } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { fmtDate } from "@/lib/format";
import { EmptyState, Badge } from "@/components/ui";

export default function ReleasePanel({ releases }: { releases: ReleaseData[] }) {
  const { t } = useT();
  if (releases.length === 0) return <EmptyState text={t("panel.release.empty")} />;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {releases.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100">{r.platform}</span>
              {r.status === "PUBLISHED" ? (
                <Badge tone="green">
                  {t("panel.release.published", { date: fmtDate(r.publishedAt) })}
                </Badge>
              ) : (
                <Badge tone="amber">{t("panel.release.pending")}</Badge>
              )}
            </div>
            {r.notes && <p className="mt-1 text-xs text-zinc-500">{r.notes}</p>}
          </div>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
            >
              {t("panel.release.watch")}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
