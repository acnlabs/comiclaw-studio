"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

// 认领必须手点。打开页面、登录回来都不会自动收走项目。
// 无主人或仅官方/agent 代建时显示条；已有人东家则不显示。
export default function AutoClaim({
  shareToken,
  hasOwner,
}: {
  shareToken: string;
  hasOwner: boolean;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch("/api/user/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shareToken }),
      });
      const data = (await res.json().catch(() => null)) as {
        claimed?: boolean;
        alreadyOwned?: boolean;
      } | null;
      if (data?.claimed || data?.alreadyOwned) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 5000);
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (hasOwner) return null;

  if (saved) {
    return (
      <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm text-emerald-400 backdrop-blur">
        ✓ {t("claim.saved")}
      </div>
    );
  }

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-zinc-300">
        <span>{t("claim.hint")}</span>
        <button
          onClick={() => loginWithRedirect({ appState: { returnTo: pathname || "/" } })}
          className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
        >
          {t("claim.login")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-zinc-300">
      <span>{error ? t("claim.fail") : t("claim.prompt")}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void claim()}
        className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t("claim.action")}
      </button>
    </div>
  );
}
