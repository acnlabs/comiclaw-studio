"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { Modal } from "@/components/ui";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { agentDisplayLabel } from "@/lib/myAgents";
import {
  ALLOWED_PLOT_COVER_MIME,
  MAX_PLOT_COVER_BYTES,
} from "@/lib/plotCover";

const AGENTPLANET_HOME =
  process.env.NEXT_PUBLIC_AGENTPLANET_APP_URL ?? "https://agentplanet.org";
const GUIDE_AGENT_KEY = "play.create.guideAgent";
const TITLE_ID = "play-create-title";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent";

type AgentRow = { id: string; name: string };

export default function PlayCreateButton({
  nextX,
  nextY,
  nextIndex,
}: {
  nextX: number;
  nextY: number;
  nextIndex: number;
}) {
  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [picked, setPicked] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [factsOpen, setFactsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useCallback(async () => {
    return getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE },
    });
  }, [getAccessTokenSilently]);

  const rememberGuide = useCallback((id: string) => {
    setPicked(id);
    try {
      sessionStorage.setItem(GUIDE_AGENT_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/agents", {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const data = (await res.json().catch(() => null)) as {
        agents?: AgentRow[];
        error?: string;
      } | null;
      const list = data?.agents;
      if (!res.ok || !list) {
        setAgents([]);
        setError(data?.error || t("play.createAgentsError"));
        return;
      }
      setAgents(list);
      const saved =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(GUIDE_AGENT_KEY)
          : null;
      const fallback = list.find((a) => a.id === saved)?.id ?? list[0]?.id ?? "";
      setPicked((prev) => prev || fallback);
    } catch {
      setAgents([]);
      setError(t("play.createAgentsError"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    if (open && isAuthenticated) void loadAgents();
  }, [open, isAuthenticated, loadAgents]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const clearCover = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setCoverFile(null);
    setCoverPreview("");
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    clearCover();
    setFactsOpen(false);
    setError(null);
  };

  const start = async () => {
    if (!isAuthenticated) {
      await loginWithRedirect({
        appState: { returnTo: pathname || "/play" },
      });
      return;
    }
    resetForm();
    setOpen(true);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const onCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_PLOT_COVER_BYTES) {
      setError(t("play.createCoverTooLarge"));
      return;
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_PLOT_COVER_MIME.test(mime)) {
      setError(t("play.createCoverError"));
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setCoverFile(file);
    setCoverPreview(url);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !picked || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const auth = `Bearer ${await token()}`;
      const body = new FormData();
      body.append("ownerAgentId", picked);
      body.append("name", name.trim());
      if (description.trim()) body.append("description", description.trim());
      if (coverFile) body.append("file", coverFile);

      const res = await fetch("/api/user/plots", {
        method: "POST",
        headers: { Authorization: auth },
        body,
      });
      const data = (await res.json().catch(() => null)) as {
        x?: number;
        y?: number;
        name?: string;
        sharePath?: string;
        error?: string;
      } | null;

      if (res.status === 409 || data?.error === "plot_claim_race") {
        setError(t("play.createConflict"));
        router.refresh();
        return;
      }
      if (!res.ok || data?.x == null || data?.y == null) {
        setError(data?.error || t("play.createError"));
        return;
      }

      setOpen(false);
      const params = new URLSearchParams({
        view: "map",
        created: "1",
        name: data.name ?? name.trim(),
        x: String(data.x),
        y: String(data.y),
      });
      if (data.sharePath) params.set("studio", data.sharePath);
      router.push(`/play?${params.toString()}`);
      router.refresh();
    } catch {
      setError(t("play.createError"));
    } finally {
      setBusy(false);
    }
  };

  const guide = agents?.find((a) => a.id === picked);
  const guideLabel = guide ? agentDisplayLabel(guide.name, guide.id) : picked;
  const factSummary = t("play.createFactSummary", {
    x: nextX,
    y: nextY,
    n: nextIndex + 1,
  });

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={start}
        title={t("play.createHint")}
        className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
      >
        {t("play.createOpen")}
      </button>

      <Modal open={open} onClose={close} titleId={TITLE_ID}>
        <form
          onSubmit={create}
          className="flex max-h-[calc(92vh-2.5rem)] flex-col"
          aria-labelledby={TITLE_ID}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-8">
            <h2 id={TITLE_ID} className="text-lg font-semibold text-zinc-50">
              {t("play.createTitle")}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{t("play.createHint")}</p>

            <label className="mt-5 block text-sm text-zinc-400">
              {t("play.createName")}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                autoFocus
                placeholder={t("play.createNamePlaceholder")}
                className={inputClass}
              />
            </label>

            <label className="mt-4 block text-sm text-zinc-400">
              {t("play.createDescription")}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t("play.createDescriptionPlaceholder")}
                className={inputClass}
              />
            </label>

            <div className="mt-4">
              <span className="text-sm text-zinc-400">{t("play.createCover")}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600 disabled:opacity-50"
                >
                  {t("play.createCoverUpload")}
                </button>
                {coverPreview ? (
                  <button
                    type="button"
                    onClick={clearCover}
                    className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300"
                  >
                    {t("play.createCoverRemove")}
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={onCoverFile}
              />
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt=""
                  className="mt-2 h-32 w-full rounded-lg object-cover"
                />
              ) : null}
            </div>

            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60">
              <button
                type="button"
                onClick={() => setFactsOpen((v) => !v)}
                aria-expanded={factsOpen}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm text-zinc-300 hover:text-zinc-100"
              >
                <span>{factSummary}</span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {factsOpen ? t("play.createFactHide") : t("play.createFactShow")}
                </span>
              </button>
              {factsOpen ? (
                <dl className="grid grid-cols-1 gap-2 border-t border-zinc-800 px-3 py-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-zinc-500">{t("play.createFactCoordLabel")}</dt>
                    <dd className="mt-0.5 font-mono text-zinc-200">
                      ({nextX}, {nextY})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">{t("play.createFactOrderLabel")}</dt>
                    <dd className="mt-0.5 text-zinc-200">
                      {t("play.createFactOrder", { n: nextIndex + 1 })}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-zinc-500">{t("play.createFactRolesLabel")}</dt>
                    <dd className="mt-0.5 text-zinc-300">{t("play.createFactRoles")}</dd>
                  </div>
                </dl>
              ) : null}
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm text-zinc-400">{t("play.createPickAgent")}</legend>
              {picked ? (
                <p className="mt-1 text-xs text-zinc-400">
                  {t("play.createGuidePicked", { name: guideLabel })}
                </p>
              ) : null}
              {loading ? (
                <p className="mt-3 text-sm text-zinc-500">{t("play.createLoadingAgents")}</p>
              ) : agents && agents.length === 0 && !error ? (
                <p className="mt-3 text-sm text-zinc-400">
                  {t("play.createNoAgents")}{" "}
                  <a
                    href={AGENTPLANET_HOME}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {t("play.createClaimAgent")}
                  </a>
                </p>
              ) : (
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-1">
                  {(agents ?? []).map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-800">
                        <input
                          type="radio"
                          name="plot-guide"
                          checked={picked === a.id}
                          onChange={() => rememberGuide(a.id)}
                          className="accent-[var(--accent)]"
                        />
                        <span className="min-w-0 truncate text-zinc-100">
                          {agentDisplayLabel(a.name, a.id)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          </div>

          <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-zinc-800 bg-zinc-900 pt-4 pr-8">
            <button
              type="button"
              onClick={close}
              className="rounded-full px-3.5 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              {t("studioCreate.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || !picked || loading || !name.trim()}
              className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
            >
              {busy ? t("play.creating") : t("play.createConfirm")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
