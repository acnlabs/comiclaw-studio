"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  RefMigrationPlan,
  RefMigrationResult,
} from "@/lib/characterRefMigration";

type PlanResponse = {
  configured: boolean;
  total: number;
  plans: RefMigrationPlan[];
};

/**
 * Run the registry cutover from the browser.
 *
 * The plan is loaded fresh from the live registry every time, because the only
 * trustworthy answer to "what still needs moving" is what AgentPlanet says
 * right now — a local flag would go stale the moment a run half-finished.
 */
export default function CharacterRefOpsPanel() {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [results, setResults] = useState<RefMigrationResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/character-refs", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setPlan(await res.json());
    } catch {
      setError("读取迁移状态失败，请重试");
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/character-refs", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (active) setPlan(data);
      } catch {
        if (active) setError("读取迁移状态失败，请重试");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/character-refs", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: RefMigrationResult[] };
      setResults(data.results);
      await load();
    } catch {
      setError("迁移执行失败，请查看服务端日志后重试");
    } finally {
      setBusy(false);
    }
  };

  if (error && !plan) {
    return <p className="mt-8 text-sm text-red-400">{error}</p>;
  }
  if (!plan) {
    return <p className="mt-8 text-sm text-zinc-500">读取中…</p>;
  }
  if (!plan.configured) {
    return (
      <p className="mt-8 text-sm text-red-400">
        AgentPlanet 未配置（缺 AGENTPLANET_API_URL / AGENTPLANET_INTERNAL_TOKEN），
        无法读取登记状态。
      </p>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-sm text-zinc-400">
        共 {plan.total} 个角色有背后资产，其中{" "}
        <span className="text-zinc-100">{plan.plans.length}</span> 条需要迁移。
      </p>

      {plan.plans.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">
          没有待迁移的登记。
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {plan.plans.map((p) => (
            <li
              key={p.characterId}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-zinc-100">{p.name}</h3>
                <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {p.action === "move" ? "搬迁登记" : "续做上架"}
                </span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2">
                <div>
                  产权:{" "}
                  <span className="text-zinc-300">
                    {p.ownerType}:{p.ownerId}
                  </span>
                </div>
                <div>
                  价格: <span className="text-zinc-300">{p.licensePoints} Credits</span>
                </div>
                <div>
                  旧 ref: {p.oldRegistered ? "仍在登记" : "已注销"} · 旧商品:{" "}
                  {p.oldProductId ?? "无"}
                </div>
                <div>
                  新 ref: {p.newRegistered ? "已登记" : "未登记"} · 新商品:{" "}
                  {p.newProductId ?? "无"}
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {plan.plans.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply()}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "执行中…" : "执行迁移"}
          </button>
          <p className="text-xs text-zinc-600">
            先下架旧商品，再登记新 ref，成功后才注销旧 ref。登记失败会把旧商品放回在售。
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      {results ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <h3 className="text-sm font-medium text-zinc-100">执行结果</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {results.map((r) => (
              <li
                key={r.characterId}
                className={r.ok ? "text-zinc-400" : "text-red-400"}
              >
                {r.ok ? "✓" : "✗"} {r.name} — {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
