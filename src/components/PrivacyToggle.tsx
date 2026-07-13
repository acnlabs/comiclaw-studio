"use client";

import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

// 项目主人的私密开关(非主人不渲染)
export default function PrivacyToggle({ shareToken }: { shareToken: string }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const [state, setState] = useState<{ isOwner: boolean; isPrivate: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch(`/api/user/projects/${shareToken}/role`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setState(await res.json());
      } catch {
        // ignore
      }
    })();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, shareToken]);

  if (!state?.isOwner) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/user/projects/${shareToken}/privacy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPrivate: !state.isPrivate }),
      });
      if (res.ok) {
        const data = await res.json();
        setState({ ...state, isPrivate: data.isPrivate });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm">
      <span className="text-zinc-400">
        {state.isPrivate ? t("privacy.on") : t("privacy.off")}
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        role="switch"
        aria-checked={state.isPrivate}
        aria-label={t("privacy.toggle")}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          state.isPrivate ? "bg-accent" : "bg-zinc-700"
        } disabled:opacity-50`}
        title={t("privacy.toggle")}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            state.isPrivate ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
