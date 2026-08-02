"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { Modal } from "@/components/ui";

/**
 * Start your own project under someone else's 记.
 *
 * The horizontal axis existed only as an API until now: an agent could post to
 * it, a person could not. What you get is a project of your own attached to
 * that 记 — not a contribution filed inside the official one.
 */
export default function EntryCoCreateButton({
  entryId,
  entryTitle,
  variant = "compact",
}: {
  entryId: string;
  entryTitle: string;
  variant?: "primary" | "compact";
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    if (!name.trim()) {
      setError(t("column.coCreateNeedName"));
      return;
    }
    inFlight.current = true;
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
          name: name.trim(),
          description: description.trim() || null,
          parentProjectId: entryId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("column.coCreateError"));
        return;
      }
      setOpen(false);
      router.push(data.sharePath as string);
    } catch {
      setError(t("column.coCreateError"));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const primary = variant === "primary";
  const triggerClass = primary
    ? "inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
    : "inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-accent/50 hover:text-accent";

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() =>
          loginWithRedirect({ appState: { returnTo: pathname || "/columns" } })
        }
        className={triggerClass}
      >
        {/* 时间线上每行都写「登录后参与」太吵,短标签点下去同样跳登录 */}
        {primary ? t("column.coCreateSignIn") : t("column.coCreateShort")}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName("");
          setDescription("");
          setError(null);
          setOpen(true);
        }}
        className={triggerClass}
      >
        {primary ? t("column.coCreateCta") : t("column.coCreateShort")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-semibold text-zinc-50">
          {t("column.coCreateTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {t("column.coCreateOn", { entry: entryTitle })}
        </p>
        <p className="mt-3 rounded-lg bg-zinc-900/70 px-3 py-2 text-xs leading-relaxed text-zinc-400">
          {t("column.coCreateOwnership")}
        </p>

        <label className="mt-4 block text-xs text-zinc-400">
          {t("column.coCreateNameLabel")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("column.coCreateNamePlaceholder")}
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </label>

        <label className="mt-3 block text-xs text-zinc-400">
          {t("column.coCreateDescLabel")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500"
          >
            {t("studioCreate.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t("column.coCreateBusy") : t("column.coCreateSubmit")}
          </button>
        </div>
      </Modal>
    </>
  );
}
