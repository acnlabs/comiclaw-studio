"use client";

import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import CreditsLedgerView from "@/components/credits/CreditsLedgerView";
import type { Ledger } from "@/components/credits/types";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

const API_BASE =
  process.env.NEXT_PUBLIC_AGENTPLANET_API_URL ?? "https://api.agentplanet.org";

/** Fetching half: comiclaw attribution from our API, balance straight from AgentPlanet. */
export default function CreditsLedger() {
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } =
    useAuth0();
  const { t } = useT();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let active = true;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const [ledgerRes, walletRes] = await Promise.all([
          fetch("/api/user/credits", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/users/me/wallet`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }).catch(() => null),
        ]);
        const data = (await ledgerRes.json()) as Ledger;
        if (!active) return;
        setLedger(data);
        if (walletRes?.ok) {
          const wallet = await walletRes.json();
          if (active && typeof wallet?.balance === "number") {
            setBalance(wallet.balance);
          }
        }
      } catch {
        if (active) setLedger(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-zinc-600">…</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center">
        <p className="text-sm text-zinc-400">{t("credits.signInHint")}</p>
        <button
          onClick={() => loginWithRedirect({ appState: { returnTo: "/credits" } })}
          className="mt-5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
        >
          {t("nav.login")}
        </button>
      </div>
    );
  }

  return <CreditsLedgerView ledger={ledger} balance={balance} />;
}
