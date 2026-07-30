"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { WALLET_URL } from "@/components/CreditsBadge";
import type { Ledger } from "@/components/credits/types";
import { mergeLedgerEntries, type LedgerEntry } from "@/lib/creditsLedger";
import type { MessageKey } from "@/lib/i18n";

type Filter = "all" | "earn" | "spend";

const FILTERS: { id: Filter; label: MessageKey }[] = [
  { id: "all", label: "credits.filterAll" },
  { id: "earn", label: "credits.filterEarned" },
  { id: "spend", label: "credits.filterSpent" },
];

const KNOWN_STATUS_LABELS: Record<string, MessageKey> = {
  INSUFFICIENT_BALANCE: "chargeStatus.INSUFFICIENT_BALANCE",
  ERROR: "chargeStatus.ERROR",
};

type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>
) => string;

/** An unexpected status must not leak a raw i18n key into the page. */
function chargeStatusLabel(status: string, t: Translate): string {
  const key = KNOWN_STATUS_LABELS[status];
  return key ? t(key) : t("chargeStatus.ERROR");
}

function actionLabel(action: string | null, t: Translate): string {
  return t(`chargeAction.${action ?? "unknown"}` as MessageKey);
}

/** Presentational half of the credits page: no fetching, so it can be previewed. */
export default function CreditsLedgerView({
  ledger,
  balance,
}: {
  ledger: Ledger | null;
  balance: number | null;
}) {
  const { t, fmtDate } = useT();
  const [filter, setFilter] = useState<Filter>("all");

  const entries: LedgerEntry[] = ledger
    ? mergeLedgerEntries(ledger.earned.rows, ledger.spent.rows)
    : [];
  const visible =
    filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <div className="mt-8 space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div>
          <p className="text-xs text-zinc-500">{t("credits.balanceLabel")}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {balance === null ? "—" : balance.toLocaleString()}
          </p>
        </div>
        <a
          href={WALLET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-600 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-400 hover:text-zinc-100"
        >
          {t("credits.openWallet")}
        </a>
      </section>

      {ledger === null ? (
        <div className="py-10 text-center text-sm text-zinc-600">…</div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <p className="text-xs text-zinc-500">{t("credits.earnedTitle")}</p>
              <p className="mt-1 text-xl font-semibold text-accent">
                +{ledger.earned.total.toLocaleString()}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                {t("credits.earnedSubtitle")}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
              <p className="text-xs text-zinc-500">{t("credits.spentTitle")}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                ≈ −{ledger.spent.total.toLocaleString()}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                {t("credits.spentSubtitle")}
              </p>
            </div>
          </section>

          <section>
            <div className="inline-flex rounded-full bg-zinc-800/80 p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    filter === f.id
                      ? "bg-accent text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t(f.label)}
                </button>
              ))}
            </div>

            {filter !== "spend" && ledger.earned.byCharacter.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {ledger.earned.byCharacter.map((c) => (
                  <li
                    key={c.characterId}
                    className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3.5 py-1.5 text-xs text-zinc-300"
                  >
                    {c.characterName}
                    <span className="ml-2 text-accent">
                      +{c.credits.toLocaleString()}
                    </span>
                    <span className="ml-1 text-zinc-600">
                      ({t("credits.licenseCount", { n: c.licenseCount })})
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {filter !== "earn" && ledger.spent.byAction.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {ledger.spent.byAction.map((a) => (
                  <li
                    key={a.action}
                    className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3.5 py-1.5 text-xs text-zinc-300"
                  >
                    {actionLabel(a.action, t)}
                    <span className="ml-2 text-zinc-400">
                      −{a.credits.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {visible.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
                {filter === "earn"
                  ? t("credits.earnedEmpty")
                  : filter === "spend"
                    ? t("credits.spentEmpty")
                    : t("credits.allEmpty")}
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-zinc-900/50">
                {visible.map((e) => (
                  <li
                    key={`${e.kind}-${e.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-100">
                        {e.kind === "earn"
                          ? e.characterName
                          : actionLabel(e.action, t)}
                        {e.projectName ? (
                          <span className="text-zinc-500"> · {e.projectName}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-600">
                        {fmtDate(e.createdAt)}
                        <span className="ml-2 text-zinc-700">
                          {e.kind === "earn"
                            ? t("credits.rowEarned")
                            : t("credits.rowSpent")}
                        </span>
                        {e.kind === "spend" && e.status !== "SUCCESS" ? (
                          <span className="ml-2 text-amber-500">
                            {chargeStatusLabel(e.status, t)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {e.kind === "earn" ? (
                      <span className="shrink-0 text-sm text-accent">
                        +{e.points.toLocaleString()}
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 text-sm ${
                          e.status === "SUCCESS" ? "text-zinc-300" : "text-zinc-600"
                        }`}
                      >
                        {e.status === "SUCCESS"
                          ? `−${(e.amount ?? 0).toLocaleString()}`
                          : "—"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 space-y-1 text-xs text-zinc-600">
              {filter !== "spend" ? <p>{t("credits.grossNote")}</p> : null}
              {filter !== "earn" ? <p>{t("credits.approxNote")}</p> : null}
              {filter !== "earn" && ledger.spent.failedCount > 0 ? (
                <p>
                  {t(
                    ledger.spent.failedCount === 1
                      ? "credits.failedHintOne"
                      : "credits.failedHint",
                    { n: ledger.spent.failedCount }
                  )}
                </p>
              ) : null}
              {ledger.truncated ? <p>{t("credits.recentOnly")}</p> : null}
            </div>
          </section>

          <p className="text-xs leading-relaxed text-zinc-600">
            {t("credits.ledgerNote")}{" "}
            <Link
              href="/studio"
              className="text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
            >
              {t("nav.studio")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
