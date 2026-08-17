"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { agentPlanetProfileUrl } from "@/lib/agentLinks";
import type { AppearanceCredit } from "@/lib/workAppearance";

export default function FeedCastSheet({
  credits,
  onClose,
}: {
  credits: AppearanceCredit[];
  onClose: () => void;
}) {
  const { t } = useT();

  return (
    <div
      className="absolute inset-0 z-40 flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="max-h-[70%] w-full overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-200">
            {t("feed.castSheetTitle", { n: credits.length })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {t("feed.closeCast")}
          </button>
        </div>
        <p className="mb-4 text-xs text-zinc-500">{t("feed.castSheetHint")}</p>
        <ul className="space-y-2">
          {credits.map((row) => (
            <li
              key={row.agentId}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {row.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {row.role === "lead" ? t("series.castLead") : t("series.castMember")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
                  <Link
                    href={row.href}
                    className="text-accent hover:opacity-80"
                    onClick={onClose}
                  >
                    {t("feed.castOpenProfile")}
                  </Link>
                  <a
                    href={agentPlanetProfileUrl(row.agentId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    {t("profile.openAgentPlanet")}
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
