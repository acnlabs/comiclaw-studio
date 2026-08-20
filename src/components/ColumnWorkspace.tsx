"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

export type ColumnEpisodeRow = {
  id: string;
  name: string;
  shareToken: string;
  entryOrder: number | null;
  currentStage: string;
  coverUrl: string | null;
  workId: string | null;
};

export default function ColumnWorkspace({
  columnId,
  name,
  description,
  ownerUserId,
  episodes,
}: {
  columnId: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  episodes: ColumnEpisodeRow[];
}) {
  const { t } = useT();
  const router = useRouter();
  const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();
  const [episodeName, setEpisodeName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAdd =
    isAuthenticated && Boolean(ownerUserId) && user?.sub === ownerUserId;

  const addEpisode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy || !episodeName.trim()) {
        if (!episodeName.trim()) setError(t("columnWorkspace.needName"));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/user/projects", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: episodeName.trim(),
            columnId,
            visibility: "PUBLIC",
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          sharePath?: string;
          shareToken?: string;
          error?: string;
        } | null;
        if (!res.ok) {
          setError(data?.error || t("columnWorkspace.addError"));
          return;
        }
        setEpisodeName("");
        router.push(data?.sharePath || `/p/${data?.shareToken}`);
      } catch {
        setError(t("columnWorkspace.addError"));
      } finally {
        setBusy(false);
      }
    },
    [busy, columnId, episodeName, getAccessTokenSilently, router, t],
  );

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
      <header className="border-b border-zinc-800/80 py-6">
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 text-xs tracking-widest text-accent transition-opacity hover:opacity-80"
        >
          COMICLAW STUDIO
          <span className="text-zinc-600">{t("studio.brandSub")}</span>
        </Link>
        <p className="mt-2 text-xs text-zinc-500">{t("studioCreate.formatColumn")}</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-50 sm:text-3xl">{name}</h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-500">{t("columnWorkspace.hint")}</p>
      </header>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-300">
            {t("column.issues", { n: episodes.length })}
          </h2>
        </div>

        {episodes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-6 py-14 text-center text-sm text-zinc-500">
            {t("columnWorkspace.empty")}
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {episodes.map((ep) => (
              <li key={ep.id}>
                <Link
                  href={`/p/${ep.shareToken}`}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 transition-colors hover:border-zinc-700"
                >
                  {ep.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ep.coverUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-zinc-100">
                      {ep.entryOrder != null
                        ? t("column.entryN", { n: ep.entryOrder })
                        : null}
                      {ep.entryOrder != null ? " · " : ""}
                      {ep.name}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {t(`stage.${ep.currentStage}` as MessageKey)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {canAdd ? (
          <>
            <form
              onSubmit={addEpisode}
              className="mt-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-end"
            >
              <label className="block min-w-0 flex-1 text-sm text-zinc-400">
                {t("columnWorkspace.episodeName")}
                <input
                  value={episodeName}
                  onChange={(e) => setEpisodeName(e.target.value)}
                  placeholder={t("columnWorkspace.episodeNamePlaceholder")}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !episodeName.trim()}
                className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t("columnWorkspace.adding") : t("columnWorkspace.addEpisode")}
              </button>
            </form>
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
