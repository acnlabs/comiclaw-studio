"use client";

import { useEffect, useState } from "react";
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

interface PendingPayment {
  projectId: string;
  checkoutUrl: string;
}

// 「添加到我的项目」:选角授权的入口。
// 免费角色即时授予并物化进项目角色库;付费角色经 AgentPlanet Store 用 Credits
// 支付(去 checkout 付款 → 回来确认授权)。
export default function CastingButton({
  characterId,
  licensePoints,
  openForCasting,
}: {
  characterId: string;
  licensePoints: number;
  openForCasting: boolean;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [licensed, setLicensed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);

  const authHeader = async () => ({
    Authorization: `Bearer ${await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    })}`,
  });

  // 打开弹窗时拉取我的项目 + 已授权状态
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    (async () => {
      try {
        const h = await authHeader();
        const [pRes, lRes] = await Promise.all([
          fetch("/api/user/projects", { headers: h }),
          fetch(`/api/user/casting?characterId=${characterId}`, { headers: h }),
        ]);
        const pData = await pRes.json();
        const lData = await lRes.json();
        setProjects(pData.projects ?? []);
        setLicensed(new Set(lData.projectIds ?? []));
      } catch {
        setProjects([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated, characterId]);

  const addTo = async (projectId: string) => {
    if (busy) return;
    setBusy(projectId);
    setError(null);
    try {
      const h = await authHeader();
      const res = await fetch("/api/user/casting", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ characterId, projectId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setLicensed((prev) => new Set(prev).add(projectId));
        setSuccessId(projectId);
        setTimeout(() => setSuccessId(null), 3000);
      } else if (res.status === 402 && data?.checkoutUrl) {
        // 付费授权:去 AgentPlanet checkout 用 Credits 支付,回来确认
        setPending({ projectId, checkoutUrl: data.checkoutUrl });
        window.open(data.checkoutUrl, "_blank", "noopener");
      } else if (res.status === 402) {
        setError(t("casting.paymentUnavailable"));
      } else {
        setError(data?.error ?? "Failed");
      }
    } finally {
      setBusy(null);
    }
  };

  // 支付完成后确认授权(Studio 向 Store 核实订单已支付)。
  // silent=true 用于后台自动轮询/焦点检测:还没付款(402)时不打扰用户,只在
  // 手动点击(silent=false)时才提示「还没查到付款」;终态失败(409)始终提示。
  const confirmPaid = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!pending || busy) return;
    if (!silent) setBusy(pending.projectId);
    if (!silent) setError(null);
    try {
      const h = await authHeader();
      const res = await fetch("/api/user/casting/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify({ characterId, projectId: pending.projectId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setLicensed((prev) => new Set(prev).add(pending.projectId));
        setSuccessId(pending.projectId);
        setPending(null);
        setError(null);
        setTimeout(() => setSuccessId(null), 3000);
      } else if (res.status === 402) {
        if (!silent) setError(t("casting.notPaid"));
      } else if (res.status === 409) {
        setError(t("casting.orderDead"));
        setPending(null);
      } else if (!silent) {
        setError(data?.error ?? "Failed");
      }
    } finally {
      if (!silent) setBusy(null);
    }
  };

  // 后台自愈:打开 checkout 付款后,定时轮询 + 切回本标签页时立即查一次,
  // 客户不用手动点「我已支付」——付完款切回来基本秒级自动完成。
  useEffect(() => {
    if (!pending) return;
    const interval = setInterval(() => confirmPaid({ silent: true }), 4000);
    const onFocus = () => confirmPaid({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const priceLabel =
    licensePoints > 0 ? t("char.pointsPerProject", { n: licensePoints }) : t("char.free");

  if (isLoading) return null;

  return (
    <>
      <button
        onClick={() =>
          isAuthenticated
            ? setOpen(true)
            : loginWithRedirect({ appState: { returnTo: pathname || "/" } })
        }
        disabled={!openForCasting}
        title={!openForCasting ? t("casting.notOpen") : undefined}
        className="flex-1 rounded-full bg-accent py-2.5 text-center text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("casting.addToProject")} · {priceLabel}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4 pr-8">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">{t("casting.pickProject")}</h3>
            <p className="mt-1 text-xs text-zinc-500">{t("casting.priceNote")}</p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          {pending && (
            <div className="space-y-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
              <p className="text-sm text-zinc-300">{t("casting.payPrompt")}</p>
              <div className="flex gap-2">
                <a
                  href={pending.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-zinc-700 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  {t("casting.goPay")}
                </a>
                <button
                  onClick={() => confirmPaid()}
                  disabled={busy !== null}
                  className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy === pending.projectId ? t("casting.confirming") : t("casting.paid")}
                </button>
              </div>
            </div>
          )}

          {projects === null ? (
            <p className="py-8 text-center text-sm text-zinc-600">…</p>
          ) : projects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              {t("casting.noProjects")}
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => {
                const isLicensed = licensed.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-zinc-200">{p.name}</span>
                    {isLicensed ? (
                      <span className="shrink-0 text-xs font-medium text-emerald-400">
                        ✓ {successId === p.id ? t("casting.success") : t("casting.already")}
                      </span>
                    ) : (
                      <button
                        onClick={() => addTo(p.id)}
                        disabled={busy !== null}
                        className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === p.id ? "…" : `${t("casting.confirm")} · ${priceLabel}`}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
