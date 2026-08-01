"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { Modal } from "@/components/ui";

interface MyProject {
  id: string;
  name: string;
  shareToken: string;
}

/**
 * License a published asset into one of your projects.
 *
 * Free assets are copied in on the spot. Priced ones answer 402 with a
 * checkout link: the buyer pays on AgentPlanet and the licence lands when they
 * return, or on the next visit if they never do.
 */
export default function AssetLicenseButton({
  assetId,
  assetName,
  licensePoints = 0,
}: {
  assetId: string;
  assetName: string;
  licensePoints?: number;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [licensed, setLicensed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const inFlight = useRef(false);

  const authHeader = async () => ({
    Authorization: `Bearer ${await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    })}`,
  });

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let active = true;
    (async () => {
      try {
        const h = await authHeader();
        const [pRes, lRes] = await Promise.all([
          fetch("/api/user/projects", { headers: h }),
          fetch(`/api/user/asset-licenses?assetId=${encodeURIComponent(assetId)}`, {
            headers: h,
          }),
        ]);
        const pData = await pRes.json();
        const lData = await lRes.json();
        if (!active) return;
        setProjects(pData.projects ?? []);
        setLicensed(new Set<string>(lData.projectIds ?? []));
      } catch {
        if (active) setProjects([]);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated, assetId]);

  const license = async (projectId: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(projectId);
    setError(null);
    try {
      const h = await authHeader();
      const res = await fetch("/api/user/asset-licenses", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, projectId }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        checkoutUrl?: string;
      } | null;
      if (res.status === 402 && data?.checkoutUrl) {
        // Paid: send them to AgentPlanet to spend Credits. Reopening this
        // picker afterwards settles the licence even if they never come back
        // through the return page.
        window.open(data.checkoutUrl, "_blank", "noopener");
        setPayingFor(projectId);
        return;
      }
      if (!res.ok) {
        setError(data?.error || t("assetLicense.error"));
        return;
      }
      setLicensed((prev) => new Set(prev).add(projectId));
    } catch {
      setError(t("assetLicense.error"));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() =>
          loginWithRedirect({ appState: { returnTo: pathname || "/characters" } })
        }
        className="rounded-full border border-zinc-600 px-3.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-400"
      >
        {t("assetLicense.signInToUse")}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition hover:opacity-90"
      >
        {licensePoints > 0
          ? `${t("assetLicense.buy")} · ${t("assetLicense.price", {
              credits: String(licensePoints),
            })}`
          : t("assetLicense.addToProject")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="pr-10 text-lg font-semibold text-zinc-100">
          {t("assetLicense.pickProject")}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          {t("assetLicense.copyNote", { name: assetName })}
        </p>

        {payingFor ? (
          <p className="mt-3 text-sm text-accent">{t("assetLicense.payPrompt")}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        {projects === null ? (
          <div className="py-8 text-center text-sm text-zinc-600">…</div>
        ) : projects.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            {t("assetLicense.noProjects")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {projects.map((p) => {
              const done = licensed.has(p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-zinc-100">
                    {p.name}
                  </span>
                  {done ? (
                    <span className="shrink-0 text-xs text-accent">
                      ✓ {t("assetLicense.added")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void license(p.id)}
                      className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === p.id ? "…" : t("assetLicense.add")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </>
  );
}
