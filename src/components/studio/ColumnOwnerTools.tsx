"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

export type StudioColumn = {
  id: string;
  slug: string;
  name: string;
  coverUrl: string | null;
  acnOrgId: string | null;
  contributePolicy: string;
  issueCount: number;
  entryCount: number;
  pendingJoinRequests: number;
  updatedAt: string;
};

type JoinRequest = {
  id: string;
  agentId: string;
  status: string;
  note: string | null;
  createdAt: string;
};

/** Rename, delete-empty, and Org join requests — kept off the column workspace. */
export default function ColumnOwnerTools({
  column,
  onChanged,
}: {
  column: StudioColumn;
  onChanged: (event?: { deleted?: boolean }) => void;
}) {
  const { getAccessTokenSilently } = useAuth0();
  const { t, fmtDate } = useT();
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [renaming, setRenaming] = useState(column.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const openToken = useRef(0);

  const authHeaders = useCallback(async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    });
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getAccessTokenSilently]);

  useEffect(() => {
    setRenaming(column.name);
  }, [column.name]);

  useEffect(() => {
    openToken.current += 1;
    const token = openToken.current;
    setRequests(null);
    setError(null);
    let active = true;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(
          `/api/user/my-columns/${column.id}/join-requests?status=pending`,
          { headers }
        );
        const data = (await res.json()) as { requests?: JoinRequest[] };
        if (active && openToken.current === token) {
          setRequests(data.requests ?? []);
        }
      } catch {
        if (active && openToken.current === token) setRequests([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [column.id, authHeaders]);

  const decide = async (requestId: string, action: "approve" | "reject") => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/join-requests/${requestId}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || t("myColumns.error"));
        return;
      }
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== requestId));
      onChanged();
    } catch {
      setError(t("myColumns.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const rename = async () => {
    if (busy || inFlight.current || !renaming.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/my-columns/${column.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: renaming.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || t("myColumns.error"));
        return;
      }
      onChanged();
    } catch {
      setError(t("myColumns.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/my-columns/${column.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || t("myColumns.error"));
        return;
      }
      onChanged({ deleted: true });
    } catch {
      setError(t("myColumns.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-zinc-800 px-5 py-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-400">
          {t("myColumns.rename")}
          <input
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
            className="mt-1 block w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void rename()}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("myColumns.save")}
        </button>
        <button
          type="button"
          disabled={busy || column.entryCount > 0 || Boolean(column.acnOrgId)}
          title={
            column.acnOrgId
              ? t("myColumns.deleteOrgBlocked")
              : column.entryCount > 0
                ? t("myColumns.deleteBlocked")
                : undefined
          }
          onClick={() => void remove()}
          className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 transition hover:border-red-500 hover:text-red-400 disabled:opacity-40"
        >
          {t("myColumns.delete")}
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-300">
          {t("myColumns.joinRequests")}
        </p>
        {!column.acnOrgId ? (
          <p className="mt-2 text-xs text-zinc-600">{t("myColumns.noOrg")}</p>
        ) : requests === null ? (
          <p className="mt-2 text-xs text-zinc-600">…</p>
        ) : requests.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-600">{t("myColumns.noPending")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-accent">
                    {r.agentId}
                  </p>
                  {r.note ? (
                    <p className="mt-0.5 text-xs text-zinc-400">{r.note}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    {fmtDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(r.id, "approve")}
                    className="rounded-full bg-accent px-3.5 py-1 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {t("myColumns.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(r.id, "reject")}
                    className="rounded-full border border-zinc-600 px-3.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-400 disabled:opacity-50"
                  >
                    {t("myColumns.reject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
