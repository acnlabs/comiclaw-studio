"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { WALLET_URL } from "@/components/CreditsBadge";
import type { Ledger } from "@/components/credits/types";
import type { MessageKey } from "@/lib/i18n";

const KNOWN_STATUS_LABELS: Record<string, MessageKey> = {
  INSUFFICIENT_BALANCE: "chargeStatus.INSUFFICIENT_BALANCE",
  ERROR: "chargeStatus.ERROR",
};

/** An unexpected status must not leak a raw i18n key into the page. */
function chargeStatusLabel(
  status: string,
  t: (key: MessageKey, params?: Record<string, string | number>) => string
): string {
  const key = KNOWN_STATUS_LABELS[status];
  return key ? t(key) : t("chargeStatus.ERROR");
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

  return (
    <div className="mt-8 space-y-10">
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
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                {t("credits.earnedTitle")}
              </h2>
              <p className="text-sm text-accent">
                +{ledger.earned.total.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {t("credits.earnedSubtitle")}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {t("credits.grossNote")}
            </p>

            {ledger.earned.rows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
                {t("credits.earnedEmpty")}
              </div>
            ) : (
              <>
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
                <ul className="mt-3 divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-zinc-900/50">
                  {ledger.earned.rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">
                          {r.characterName}
                          {r.projectName ? (
                            <span className="text-zinc-500"> · {r.projectName}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {fmtDate(r.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm text-accent">
                        +{r.points.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                {ledger.earned.rows.length >= ledger.recentLimit ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    {t("credits.recentOnly", { n: ledger.recentLimit })}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                {t("credits.spentTitle")}
              </h2>
              <p className="text-sm text-zinc-300">
                ≈ −{ledger.spent.total.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {t("credits.spentSubtitle")}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {t("credits.approxNote")}
            </p>

            {ledger.spent.rows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
                {t("credits.spentEmpty")}
              </div>
            ) : (
              <>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {ledger.spent.byAction.map((a) => (
                    <li
                      key={a.action}
                      className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3.5 py-1.5 text-xs text-zinc-300"
                    >
                      {t(`chargeAction.${a.action}` as MessageKey)}
                      <span className="ml-2 text-zinc-400">
                        −{a.credits.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-3 divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-zinc-900/50">
                  {ledger.spent.rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">
                          {t(`chargeAction.${r.action ?? "unknown"}` as MessageKey)}
                          {r.projectName ? (
                            <span className="text-zinc-500"> · {r.projectName}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {fmtDate(r.createdAt)}
                          {r.status !== "SUCCESS" ? (
                            <span className="ml-2 text-amber-500">
                              {chargeStatusLabel(r.status, t)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm ${
                          r.status === "SUCCESS" ? "text-zinc-300" : "text-zinc-600"
                        }`}
                      >
                        {r.status === "SUCCESS"
                          ? `−${(r.amount ?? 0).toLocaleString()}`
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                {ledger.spent.rows.length >= ledger.recentLimit ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    {t("credits.recentOnly", { n: ledger.recentLimit })}
                  </p>
                ) : null}
                {ledger.spent.failedCount > 0 ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    {t(
                      ledger.spent.failedCount === 1
                        ? "credits.failedHintOne"
                        : "credits.failedHint",
                      { n: ledger.spent.failedCount }
                    )}
                  </p>
                ) : null}
              </>
            )}
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
