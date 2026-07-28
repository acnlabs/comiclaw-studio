"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

type MyColumn = {
  id: string;
  slug: string;
  name: string;
  acnOrgId: string | null;
  entryCount: number;
  pendingJoinRequests: number;
};

type JoinRequest = {
  id: string;
  agentId: string;
  status: string;
  note: string | null;
  createdAt: string;
};

export default function MyColumnsPanel() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t, fmtDate } = useT();

  const [columns, setColumns] = useState<MyColumn[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [renaming, setRenaming] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  /** Guards against a slow join-request fetch landing after the user switched columns. */
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

  const fetchColumns = useCallback(async (): Promise<MyColumn[]> => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/user/my-columns", { headers });
      const data = (await res.json()) as { columns?: MyColumn[] };
      return data.columns ?? [];
    } catch {
      return [];
    }
  }, [authHeaders]);

  const refreshColumns = useCallback(async () => {
    setColumns(await fetchColumns());
  }, [fetchColumns]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let active = true;
    (async () => {
      const next = await fetchColumns();
      if (active) setColumns(next);
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, fetchColumns]);

  const openColumn = async (col: MyColumn) => {
    openToken.current += 1;
    const token = openToken.current;
    if (openId === col.id) {
      setOpenId(null);
      setRequests(null);
      return;
    }
    setOpenId(col.id);
    setRenaming(col.name);
    setRequests(null);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/user/my-columns/${col.id}/join-requests?status=pending`,
        { headers }
      );
      const data = (await res.json()) as { requests?: JoinRequest[] };
      if (openToken.current === token) setRequests(data.requests ?? []);
    } catch {
      if (openToken.current === token) setRequests([]);
    }
  };

  const decide = async (
    requestId: string,
    action: "approve" | "reject"
  ) => {
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
      void refreshColumns();
    } catch {
      setError(t("myColumns.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const rename = async (columnId: string) => {
    if (busy || inFlight.current || !renaming.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/my-columns/${columnId}`, {
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
      void refreshColumns();
    } catch {
      setError(t("myColumns.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const remove = async (columnId: string) => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/my-columns/${columnId}`, {
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
      setOpenId(null);
      setRequests(null);
      void refreshColumns();
    } catch {
      setError(t("myColumns.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (!isAuthenticated || columns === null || columns.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-zinc-100">
        {t("myColumns.title")}
      </h2>
      <p className="mt-1 max-w-xl text-sm text-zinc-500">
        {t("myColumns.subtitle")}
      </p>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      <ul className="mt-4 space-y-3">
        {columns.map((c) => (
          <li key={c.id} className="border border-zinc-800 bg-zinc-900/40">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-100">{c.name}</span>
                  <Link
                    href={`/columns/${c.slug}`}
                    className="font-mono text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
                  >
                    /{c.slug}
                  </Link>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("myColumns.meta", {
                    entries: c.entryCount,
                    pending: c.pendingJoinRequests,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openColumn(c)}
                className="border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-400 hover:text-zinc-100"
              >
                {openId === c.id ? t("myColumns.close") : t("myColumns.manage")}
              </button>
            </div>

            {openId === c.id ? (
              <div className="space-y-4 border-t border-zinc-800 px-5 py-4">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-zinc-400">
                    {t("myColumns.rename")}
                    <input
                      value={renaming}
                      onChange={(e) => setRenaming(e.target.value)}
                      className="mt-1 block w-64 border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-accent"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void rename(c.id)}
                    className="bg-accent px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                  >
                    {t("myColumns.save")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || c.entryCount > 0 || Boolean(c.acnOrgId)}
                    title={
                      c.acnOrgId
                        ? t("myColumns.deleteOrgBlocked")
                        : c.entryCount > 0
                          ? t("myColumns.deleteBlocked")
                          : undefined
                    }
                    onClick={() => void remove(c.id)}
                    className="border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-500 hover:text-red-400 disabled:opacity-40"
                  >
                    {t("myColumns.delete")}
                  </button>
                </div>

                <div>
                  <p className="text-xs font-medium tracking-wide text-zinc-300 uppercase">
                    {t("myColumns.joinRequests")}
                  </p>
                  {!c.acnOrgId ? (
                    <p className="mt-2 text-xs text-zinc-600">
                      {t("myColumns.noOrg")}
                    </p>
                  ) : requests === null ? (
                    <p className="mt-2 text-xs text-zinc-600">…</p>
                  ) : requests.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-600">
                      {t("myColumns.noPending")}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {requests.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-3 border border-zinc-800 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs text-accent">
                              {r.agentId}
                            </p>
                            {r.note ? (
                              <p className="mt-0.5 text-xs text-zinc-400">
                                {r.note}
                              </p>
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
                              className="bg-accent px-3 py-1 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                            >
                              {t("myColumns.approve")}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void decide(r.id, "reject")}
                              className="border border-zinc-600 px-3 py-1 text-xs text-zinc-300 disabled:opacity-50"
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
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
