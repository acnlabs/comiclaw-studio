"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { Modal } from "@/components/ui";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import type { MessageKey } from "@/lib/i18n";
import { slugifyLabel } from "@/lib/slugify";

type Format = "VIDEO" | "DRAMA" | "COLUMN";
type Kind = "private" | "cocreate";
/** Self-serve: create or none only (attach needs Org stewardship proof). */
type OrgMode = "none" | "create";

const ORG_LABEL: Record<OrgMode, MessageKey> = {
  create: "studioCreate.org.create",
  none: "studioCreate.org.none",
};

const FORMAT_HINT: Record<Format, MessageKey> = {
  VIDEO: "studioCreate.hintVideo",
  DRAMA: "studioCreate.hintDrama",
  COLUMN: "studioCreate.hintColumn",
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent";

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

export default function StudioCreatePanel() {
  const { getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("VIDEO");
  const [kind, setKind] = useState<Kind>("private");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [orgMode, setOrgMode] = useState<OrgMode>("create");
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

  const openDialog = () => {
    setOpen(true);
    setError(null);
    setSlug("");
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();

      const fail = async (res: Response) => {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || t("studioCreate.error"));
      };

      if (format === "COLUMN") {
        const res = await fetch("/api/user/columns", {
          method: "POST",
          headers,
          body: JSON.stringify(
            kind === "private"
              ? {
                  name: name.trim(),
                  description: description.trim() || null,
                  slug: slugifyLabel(slug) || undefined,
                  orgMode: "none",
                  contributePolicy: "owner_only",
                }
              : {
                  name: name.trim(),
                  description: description.trim() || null,
                  slug: slugifyLabel(slug) || undefined,
                  orgMode,
                  orgJoinPolicy: orgMode === "create" ? "approval" : undefined,
                  contributePolicy: orgMode === "create" ? "org_members" : "open",
                },
          ),
        });
        if (!res.ok) return fail(res);
        const data = (await res.json()) as { column?: { slug?: string } };
        close();
        router.push(data.column?.slug ? `/c/${data.column.slug}` : "/studio");
        return;
      }

      const res = await fetch("/api/user/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(
          kind === "private"
            ? {
                name: name.trim(),
                description: description.trim() || null,
                visibility: "PRIVATE",
                format,
              }
            : {
                name: name.trim(),
                description: description.trim() || null,
                visibility: "PUBLIC",
                format,
                orgMode,
                orgJoinPolicy: orgMode === "create" ? "approval" : undefined,
                contributePolicy: orgMode === "create" ? "org_members" : "open",
              },
        ),
      });
      if (!res.ok) return fail(res);
      const data = await res.json();
      router.push(data.sharePath || `/p/${data.shareToken}`);
    } catch {
      setError(t("studioCreate.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
      >
        {t("studioCreate.open")}
      </button>

      <Modal open={open} onClose={close}>
        <h2 className="pr-10 text-lg font-semibold text-zinc-100">
          {t("studioCreate.title")}
        </h2>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Segmented<Format>
            value={format}
            onChange={setFormat}
            options={[
              { value: "VIDEO", label: t("studioCreate.formatVideo") },
              { value: "DRAMA", label: t("studioCreate.formatDrama") },
              { value: "COLUMN", label: t("studioCreate.formatColumn") },
            ]}
          />
          <p className="text-xs leading-relaxed text-zinc-500">{t(FORMAT_HINT[format])}</p>

          <div className="space-y-1.5">
            <p className="text-sm text-zinc-400">{t("studioCreate.collabLabel")}</p>
            <Segmented<Kind>
              value={kind}
              onChange={setKind}
              options={[
                { value: "private", label: t("studioCreate.kindPrivate") },
                { value: "cocreate", label: t("studioCreate.kindCocreate") },
              ]}
            />
            <p className="text-xs leading-relaxed text-zinc-500">
              {kind === "private"
                ? t("studioCreate.hintPrivate")
                : t("studioCreate.hintCocreate")}
            </p>
          </div>

          <label className="block text-sm text-zinc-400">
            {t("studioCreate.name")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className={inputClass}
            />
          </label>

          {format === "COLUMN" ? (
            <label className="block text-sm text-zinc-400">
              {t("studioCreate.columnSlug")}
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder={slugifyLabel(name) || t("studioCreate.columnSlugAuto")}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-zinc-600">
                {t("studioCreate.columnSlugPreview", {
                  slug:
                    slugifyLabel(slug) ||
                    slugifyLabel(name) ||
                    t("studioCreate.columnSlugAuto"),
                })}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-600">
                {t("studioCreate.columnSlugHint")}
              </span>
            </label>
          ) : null}

          <label className="block text-sm text-zinc-400">
            {t("studioCreate.description")}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </label>

          {kind === "cocreate" ? (
            <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-sm text-zinc-400">
                {t("studioCreate.orgSection")}
              </p>
              <Segmented<OrgMode>
                value={orgMode}
                onChange={setOrgMode}
                options={(["create", "none"] as OrgMode[]).map((m) => ({
                  value: m,
                  label: t(ORG_LABEL[m]),
                }))}
              />
              <p className="text-xs leading-relaxed text-zinc-600">
                {orgMode === "create"
                  ? t("studioCreate.orgCreateHint")
                  : t("studioCreate.orgNoneHint")}
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t("studioCreate.submitting") : t("studioCreate.submit")}
            </button>
            <button
              type="button"
              onClick={close}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {t("studioCreate.cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
