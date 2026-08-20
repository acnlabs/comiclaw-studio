"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { Badge } from "@/components/ui";
import { authorLine } from "@/lib/authorLine";
import type { ComiclawPublishSnapshot, SeriesOption } from "@/lib/types";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent";

const NEW_SERIES = "";

type PublishPayload = ComiclawPublishSnapshot & { canPublish: boolean };

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-zinc-800 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            o.value === value
              ? "bg-accent text-zinc-950"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ComiclawPublishForm({
  shareToken,
}: {
  shareToken: string;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const { t } = useT();
  const router = useRouter();

  const [state, setState] = useState<PublishPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [mode, setMode] = useState<"video" | "episode">("video");
  const [episodeOrder, setEpisodeOrder] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [seriesWorkId, setSeriesWorkId] = useState(NEW_SERIES);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [seriesCoverUrl, setSeriesCoverUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    });
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getAccessTokenSilently]);

  const applySnapshot = (data: PublishPayload) => {
    setState(data);
    setTitle(data.defaults.title);
    setDescription(data.defaults.description);
    setCoverUrl(data.defaults.coverUrl);
    setMode(data.defaults.mode);
    setEpisodeOrder(data.defaults.episodeOrder);
    setEpisodeTitle(data.defaults.episodeTitle);
    setSeriesWorkId(data.defaults.seriesWorkId);
    setSeriesTitle(data.defaults.seriesTitle);
    setSeriesDescription(data.defaults.seriesDescription);
    setSeriesCoverUrl(data.defaults.seriesCoverUrl);
  };

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/user/projects/${shareToken}/publish`, {
          headers,
        });
        const data = (await res.json().catch(() => null)) as
          | (PublishPayload & { error?: string })
          | null;
        if (!res.ok) {
          if (!cancelled) setLoadError(data?.error || t("panel.comiclaw.loadError"));
          return;
        }
        if (!cancelled && data) applySnapshot(data);
      } catch {
        if (!cancelled) setLoadError(t("panel.comiclaw.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, authHeaders, shareToken, t]);

  const pickSeries = (id: string, options: SeriesOption[]) => {
    setSeriesWorkId(id);
    if (!id) {
      setSeriesTitle("");
      setSeriesDescription("");
      setSeriesCoverUrl("");
      return;
    }
    const found = options.find((s) => s.id === id);
    if (found) {
      setSeriesTitle(found.title);
      setSeriesDescription(found.description ?? "");
      setSeriesCoverUrl(found.coverUrl ?? "");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/projects/${shareToken}/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          coverUrl: coverUrl.trim() || null,
          mode,
          ...(mode === "episode"
            ? {
                episodeOrder,
                episodeTitle: episodeTitle.trim() || title.trim(),
                seriesWorkId: seriesWorkId || null,
                seriesTitle: seriesTitle.trim() || null,
                seriesDescription: seriesDescription.trim() || null,
                seriesCoverUrl: seriesCoverUrl.trim() || null,
              }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        video?: { id: string; title: string };
        series?: { id: string; title: string } | null;
      } | null;
      if (!res.ok) {
        setError(data?.error || t("panel.comiclaw.error"));
        return;
      }
      const headers2 = await authHeaders();
      const refresh = await fetch(`/api/user/projects/${shareToken}/publish`, {
        headers: headers2,
      });
      const next = (await refresh.json().catch(() => null)) as PublishPayload | null;
      if (refresh.ok && next) applySnapshot(next);
      else if (data?.video) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                video: {
                  id: data.video!.id,
                  title: data.video!.title,
                  description: description.trim() || null,
                  coverUrl: coverUrl.trim() || null,
                  authorName: prev.video?.authorName ?? prev.defaults.authorName,
                },
                series: data.series
                  ? {
                      id: data.series.id,
                      title: data.series.title,
                      description: seriesDescription.trim() || null,
                      coverUrl: seriesCoverUrl.trim() || null,
                    }
                  : prev.series,
              }
            : prev,
        );
      }
      router.refresh();
    } catch {
      setError(t("panel.comiclaw.error"));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-6 text-sm text-zinc-500">
        …
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-6">
        <h2 className="text-base font-semibold text-zinc-100">
          {t("panel.comiclaw.title")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">{t("panel.comiclaw.loginHint")}</p>
        <button
          type="button"
          onClick={() => loginWithRedirect()}
          className="mt-4 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-zinc-950"
        >
          {t("nav.login")}
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-6 text-sm text-red-400">
        {loadError}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-6 text-sm text-zinc-500">
        …
      </div>
    );
  }

  const published = Boolean(state.video);
  const creatingSeries = mode === "episode" && state.canChooseSeries && !seriesWorkId;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            {t("panel.comiclaw.title")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {t("panel.comiclaw.hint")}
          </p>
        </div>
        {published ? (
          <Badge tone="green">{t("panel.comiclaw.live")}</Badge>
        ) : (
          <Badge>{t("panel.comiclaw.draft")}</Badge>
        )}
      </div>

      {state.video ? (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href={`/series/${state.video.id}`}
            className="text-accent hover:opacity-80"
          >
            {t("panel.comiclaw.watchVideo")}
          </Link>
          {state.series ? (
            <Link
              href={`/series/${state.series.id}`}
              className="text-accent hover:opacity-80"
            >
              {t("panel.comiclaw.watchSeries")}
            </Link>
          ) : null}
        </p>
      ) : null}

      {!state.canPublish ? (
        <p className="mt-4 text-sm text-zinc-500">{t("panel.comiclaw.ownerOnly")}</p>
      ) : !state.hasFilm ? (
        <p className="mt-4 text-sm text-zinc-500">{t("panel.comiclaw.needFilm")}</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm text-zinc-400">
            {t("panel.comiclaw.fieldTitle")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-zinc-400">
            {t("panel.comiclaw.fieldCover")}
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </label>
          {coverUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl.trim()}
              alt=""
              className="h-28 w-20 rounded-lg object-cover"
            />
          ) : null}
          <label className="block text-sm text-zinc-400">
            {t("panel.comiclaw.fieldDesc")}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          <div className="block text-sm text-zinc-400">
            <p>{t("panel.comiclaw.fieldAuthor")}</p>
            <p className="mt-1 text-sm text-zinc-100">
              {authorLine({
                handle: state.ownerHandle,
                authorName: state.defaults.authorName,
              }) ?? "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t("panel.comiclaw.authorHint")}
            </p>
          </div>

          {state.canChooseSeries ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">{t("panel.comiclaw.fieldMode")}</p>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "video", label: t("panel.comiclaw.modeVideo") },
                    { value: "episode", label: t("panel.comiclaw.modeEpisode") },
                  ]}
                />
              </div>

              {mode === "episode" ? (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-zinc-400">
                      {t("panel.comiclaw.fieldEpisodeOrder")}
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={episodeOrder}
                        onChange={(e) => setEpisodeOrder(Number(e.target.value) || 1)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-sm text-zinc-400">
                      {t("panel.comiclaw.fieldEpisodeTitle")}
                      <input
                        value={episodeTitle}
                        onChange={(e) => setEpisodeTitle(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-zinc-400">
                    {t("panel.comiclaw.fieldSeries")}
                    <select
                      value={seriesWorkId}
                      onChange={(e) => pickSeries(e.target.value, state.seriesOptions)}
                      className={inputClass}
                    >
                      <option value={NEW_SERIES}>{t("panel.comiclaw.seriesNew")}</option>
                      {state.seriesOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-zinc-400">
                    {creatingSeries
                      ? t("panel.comiclaw.fieldSeriesTitle")
                      : t("panel.comiclaw.fieldSeriesTitleEdit")}
                    <input
                      value={seriesTitle}
                      onChange={(e) => setSeriesTitle(e.target.value)}
                      required={creatingSeries}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    {t("panel.comiclaw.fieldSeriesDesc")}
                    <textarea
                      value={seriesDescription}
                      onChange={(e) => setSeriesDescription(e.target.value)}
                      rows={2}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    {t("panel.comiclaw.fieldSeriesCover")}
                    <input
                      value={seriesCoverUrl}
                      onChange={(e) => setSeriesCoverUrl(e.target.value)}
                      placeholder="https://"
                      className={inputClass}
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-xs text-zinc-500">
                {t("panel.comiclaw.seriesLocked", {
                  name: state.series?.title || seriesTitle || "—",
                })}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-zinc-400">
                  {t("panel.comiclaw.fieldEpisodeOrder")}
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={episodeOrder}
                    onChange={(e) => setEpisodeOrder(Number(e.target.value) || 1)}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-zinc-400">
                  {t("panel.comiclaw.fieldEpisodeTitle")}
                  <input
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block text-sm text-zinc-400">
                {t("panel.comiclaw.fieldSeriesTitleEdit")}
                <input
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm text-zinc-400">
                {t("panel.comiclaw.fieldSeriesDesc")}
                <textarea
                  value={seriesDescription}
                  onChange={(e) => setSeriesDescription(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm text-zinc-400">
                {t("panel.comiclaw.fieldSeriesCover")}
                <input
                  value={seriesCoverUrl}
                  onChange={(e) => setSeriesCoverUrl(e.target.value)}
                  placeholder="https://"
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? t("panel.comiclaw.working")
              : published
                ? t("panel.comiclaw.update")
                : t("panel.comiclaw.publish")}
          </button>
        </form>
      )}
    </section>
  );
}
