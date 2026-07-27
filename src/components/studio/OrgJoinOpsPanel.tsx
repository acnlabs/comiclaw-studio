"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

export type OrgJoinRequestRow = {
  id: string;
  acnOrgId: string;
  agentId: string;
  status: string;
  note: string | null;
  decisionNote: string | null;
  columnSlug: string | null;
  columnName: string | null;
  createdAt: string;
};

type Labels = {
  empty: string;
  approve: string;
  approving: string;
  reject: string;
  rejecting: string;
  statusApproving: string;
  noteLabel: string;
  decisionPlaceholder: string;
  agentLabel: string;
  columnLabel: string;
  orgLabel: string;
  errorGeneric: string;
};

export default function OrgJoinOpsPanel({
  requests,
  labels,
}: {
  requests: OrgJoinRequestRow[];
  labels: Labels;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const act = async (
    id: string,
    action: "approve" | "reject",
    decisionNote?: string
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPendingId(id);
    setPendingAction(action);
    try {
      const res = await fetch(`/api/admin/org-joins/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject" ? { decisionNote: decisionNote || null } : {}
        ),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error || labels.errorGeneric);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError(labels.errorGeneric);
    } finally {
      inFlight.current = false;
      setPendingId(null);
      setPendingAction(null);
    }
  };

  if (requests.length === 0) {
    return (
      <p className="mt-8 border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">
        {labels.empty}
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <ul className="space-y-3">
        {requests.map((r) => {
          const rowBusy = pendingId === r.id || isPending;
          const claimInFlight = r.status === "approving";
          return (
            <li
              key={r.id}
              className="border border-zinc-800 bg-zinc-900/40 px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-medium text-zinc-100">
                    {labels.agentLabel}:{" "}
                    <span className="font-mono text-accent">{r.agentId}</span>
                    {claimInFlight ? (
                      <span className="ml-2 text-xs font-normal text-amber-400">
                        {labels.statusApproving}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {labels.columnLabel}:{" "}
                    {r.columnName || r.columnSlug || "—"}
                    {r.columnSlug ? ` (${r.columnSlug})` : ""}
                  </p>
                  <p className="truncate font-mono text-[11px] text-zinc-600">
                    {labels.orgLabel}: {r.acnOrgId}
                  </p>
                  {r.note ? (
                    <p className="pt-1 text-xs text-zinc-400">
                      {labels.noteLabel}: {r.note}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-zinc-600">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[220px]">
                  <button
                    type="button"
                    disabled={rowBusy || inFlight.current}
                    onClick={() => void act(r.id, "approve")}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pendingId === r.id && pendingAction === "approve"
                      ? labels.approving
                      : labels.approve}
                  </button>
                  <input
                    type="text"
                    value={rejectNotes[r.id] ?? ""}
                    onChange={(e) =>
                      setRejectNotes((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                    disabled={claimInFlight || rowBusy}
                    placeholder={labels.decisionPlaceholder}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={claimInFlight || rowBusy || inFlight.current}
                    onClick={() =>
                      void act(r.id, "reject", rejectNotes[r.id]?.trim())
                    }
                    className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-400 hover:text-zinc-100 disabled:opacity-50"
                  >
                    {pendingId === r.id && pendingAction === "reject"
                      ? labels.rejecting
                      : labels.reject}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
