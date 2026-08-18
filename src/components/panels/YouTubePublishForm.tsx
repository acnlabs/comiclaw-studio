"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { Badge } from "@/components/ui";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent";

type YoutubeSnapshot = {
  configured: boolean;
  hasFilm: boolean;
  hasOwnerUser: boolean;
  isOwner: boolean;
  canPublish: boolean;
  connected: boolean;
  channelTitle: string | null;
  defaults: { title: string; description: string };
  release: { id: string; url: string | null; status: string } | null;
};

export default function YouTubePublishForm({
  shareToken,
}: {
  shareToken: string;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const { t } = useT();
  const router = useRouter();

  const [state, setState] = useState<YoutubeSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConnect = useRef(false);
  const [oauthQuery] = useState(() => {
    if (typeof window === "undefined") {
      return { youtube: null as string | null, reason: null as string | null };
    }
    const params = new URLSearchParams(window.location.search);
    return { youtube: params.get("youtube"), reason: params.get("reason") };
  });

  const authHeaders = useCallback(async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    });
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getAccessTokenSilently]);

  const applySnapshot = (data: YoutubeSnapshot) => {
    setState(data);
    setTitle((prev) => prev || data.defaults.title);
    setDescription((prev) => prev || data.defaults.description);
  };

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/user/projects/${shareToken}/youtube`, {
          headers,
        });
        const data = (await res.json().catch(() => null)) as
          | (YoutubeSnapshot & { error?: string })
          | null;
        if (!res.ok) {
          if (!cancelled) setLoadError(data?.error || t("panel.youtube.loadError"));
          return;
        }
        if (!cancelled && data) applySnapshot(data);
      } catch {
        if (!cancelled) setLoadError(t("panel.youtube.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, authHeaders, shareToken, t]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/user/youtube/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({ returnTo: `/p/${shareToken}` }),
      });
      const data = (await res.json().catch(() => null)) as {
        authorizeUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.authorizeUrl) {
        setError(data?.error || t("panel.youtube.error"));
        return;
      }
      window.location.href = data.authorizeUrl;
    } catch {
      setError(t("panel.youtube.error"));
    } finally {
      setBusy(false);
    }
  }, [authHeaders, shareToken, t]);

  useEffect(() => {
    if (autoConnect.current) return;
    if (oauthQuery.youtube !== "connect") return;
    if (!state?.configured || !state.isOwner || state.connected) return;
    autoConnect.current = true;
    void connect();
  }, [connect, oauthQuery.youtube, state]);

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/user/youtube", { method: "DELETE", headers });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || t("panel.youtube.error"));
        return;
      }
      setState((prev) =>
        prev
          ? { ...prev, connected: false, channelTitle: null, canPublish: false }
          : prev,
      );
    } catch {
      setError(t("panel.youtube.error"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/projects/${shareToken}/youtube`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          privacy,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        url?: string;
        release?: { id: string; url: string | null; status: string };
      } | null;
      if (!res.ok) {
        setError(data?.error || t("panel.youtube.error"));
        return;
      }
      if (data?.release || data?.url) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                release: data.release ?? {
                  id: "new",
                  url: data.url ?? null,
                  status: "PUBLISHED",
                },
              }
            : prev,
        );
      }
      router.refresh();
    } catch {
      setError(t("panel.youtube.error"));
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
          {t("panel.youtube.title")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">{t("panel.youtube.loginHint")}</p>
        <button
          type="button"
          onClick={() =>
            loginWithRedirect({
              appState: { returnTo: `/p/${shareToken}?youtube=connect` },
            })
          }
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

  const published = Boolean(state.release?.url);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            {t("panel.youtube.title")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {t("panel.youtube.hint")}
          </p>
        </div>
        {published ? (
          <Badge tone="green">{t("panel.comiclaw.live")}</Badge>
        ) : state.connected ? (
          <Badge tone="green">{t("panel.youtube.connected")}</Badge>
        ) : (
          <Badge>{t("panel.comiclaw.draft")}</Badge>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500">{t("panel.youtube.earnNote")}</p>

      {oauthQuery.youtube === "connected" ? (
        <p className="mt-3 text-sm text-emerald-400">
          {t("panel.youtube.connectedFlash")}
        </p>
      ) : null}

      {state.release?.url ? (
        <p className="mt-3 text-sm">
          <a
            href={state.release.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:opacity-80"
          >
            {t("panel.youtube.watch")}
          </a>
        </p>
      ) : null}

      {!state.configured ? (
        <p className="mt-4 text-sm text-zinc-500">{t("panel.youtube.notConfigured")}</p>
      ) : !state.hasOwnerUser ? (
        <p className="mt-4 text-sm text-zinc-500">{t("panel.youtube.needOwner")}</p>
      ) : !state.isOwner ? (
        <p className="mt-4 text-sm text-zinc-500">{t("panel.youtube.ownerOnly")}</p>
      ) : !state.hasFilm ? (
        <p className="mt-4 text-sm text-zinc-500">{t("panel.youtube.needFilm")}</p>
      ) : !state.connected ? (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {t("panel.youtube.connect")}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <p className="text-sm text-zinc-400">
            {t("panel.youtube.connected")}
            {state.channelTitle ? ` · ${state.channelTitle}` : ""}
            <button
              type="button"
              onClick={disconnect}
              className="ml-3 text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              {t("panel.youtube.disconnect")}
            </button>
          </p>
          <label className="block text-sm text-zinc-400">
            {t("panel.youtube.fieldTitle")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-zinc-400">
            {t("panel.youtube.fieldDesc")}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-zinc-400">
            {t("panel.youtube.fieldPrivacy")}
            <select
              value={privacy}
              onChange={(e) =>
                setPrivacy(e.target.value as "public" | "unlisted" | "private")
              }
              className={inputClass}
            >
              <option value="public">{t("panel.youtube.privacyPublic")}</option>
              <option value="unlisted">{t("panel.youtube.privacyUnlisted")}</option>
              <option value="private">{t("panel.youtube.privacyPrivate")}</option>
            </select>
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? t("panel.youtube.working")
              : published
                ? t("panel.youtube.republish")
                : t("panel.youtube.publish")}
          </button>
        </form>
      )}

      {(error || oauthQuery.youtube === "error") && !state.connected ? (
        <p className="mt-3 text-sm text-red-400">
          {error || oauthQuery.reason || t("panel.youtube.error")}
        </p>
      ) : null}
    </section>
  );
}
