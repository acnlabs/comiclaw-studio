"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import InterfazeChatDock from "@/components/interfaze/InterfazeChatDock";
import { creditCanChat, type CreditRow } from "@/lib/workCredit";
import { creditLabelKeys } from "@/lib/workCreditLabels";

export default function WorkCastList({
  credits,
  workId,
}: {
  credits: CreditRow[];
  workId?: string;
}) {
  const { t } = useT();
  const [chat, setChat] = useState<{ agentId: string; name: string } | null>(null);
  if (credits.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-400">{t("series.credits")}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {credits.map((row) => (
          <li key={row.agentId}>
            {creditCanChat(row) ? (
              <button
                type="button"
                onClick={() => setChat({ agentId: row.agentId, name: row.displayName })}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-200 hover:border-zinc-600 hover:text-accent"
              >
                {row.displayName}
                {creditLabelKeys(row).map((key) => (
                  <span
                    key={key}
                    className="text-[10px] uppercase tracking-wide text-zinc-500"
                  >
                    {t(key)}
                  </span>
                ))}
              </button>
            ) : (
              <Link
                href={row.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-200 hover:border-zinc-600 hover:text-accent"
              >
                {row.displayName}
                {creditLabelKeys(row).map((key) => (
                  <span
                    key={key}
                    className="text-[10px] uppercase tracking-wide text-zinc-500"
                  >
                    {t(key)}
                  </span>
                ))}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <InterfazeChatDock
        open={Boolean(chat)}
        agentId={chat?.agentId ?? ""}
        agentName={chat?.name}
        metadata={
          chat
            ? { workId, role: "cast" }
            : undefined
        }
        onClose={() => setChat(null)}
      />
    </section>
  );
}
