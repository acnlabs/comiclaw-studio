"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import type { MessageKey } from "@/lib/i18n";

type Kind = "private" | "cocreate";
type ColumnMode = "existing" | "new";
type OrgMode = "none" | "create" | "attach";

type MyColumn = { id: string; slug: string; name: string };

const ORG_LABEL: Record<OrgMode, MessageKey> = {
  create: "studioCreate.org.create",
  attach: "studioCreate.org.attach",
  none: "studioCreate.org.none",
};

export default function StudioCreatePanel() {
  const { getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const router = useRouter();

  const [kind, setKind] = useState<Kind>("private");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columnMode, setColumnMode] = useState<ColumnMode>("existing");
  const [myColumns, setMyColumns] = useState<MyColumn[]>([]);
  const [columnId, setColumnId] = useState("");
  const [columnName, setColumnName] = useState("");
  const [columnSlug, setColumnSlug] = useState("");
  const [orgMode, setOrgMode] = useState<OrgMode>("create");
  const [acnOrgId, setAcnOrgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/user/my-columns", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { columns?: MyColumn[] };
        const cols = data.columns ?? [];
        setMyColumns(cols);
        if (cols[0]) setColumnId(cols[0].id);
      } catch {
        setMyColumns([]);
      }
    })();
  }, [getAccessTokenSilently]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      if (kind === "private") {
        const res = await fetch("/api/user/projects", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            visibility: "PRIVATE",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            typeof data.error === "string" ? data.error : t("studioCreate.error")
          );
          return;
        }
        router.push(data.sharePath || `/p/${data.shareToken}`);
        return;
      }

      let targetColumnId = columnId;
      if (columnMode === "new") {
        const colRes = await fetch("/api/user/columns", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: columnName.trim() || name.trim(),
            slug: columnSlug.trim() || undefined,
            description: description.trim() || null,
            orgMode,
            acnOrgId: orgMode === "attach" ? acnOrgId.trim() || undefined : undefined,
            orgJoinPolicy: "approval",
            contributePolicy: "org_members",
          }),
        });
        const colData = await colRes.json().catch(() => ({}));
        if (!colRes.ok) {
          setError(
            typeof colData.error === "string"
              ? colData.error
              : t("studioCreate.error")
          );
          return;
        }
        targetColumnId = colData.column?.id;
      }

      if (!targetColumnId) {
        setError(t("studioCreate.needColumn"));
        return;
      }

      const res = await fetch("/api/user/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility: "PUBLIC",
          columnId: targetColumnId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : t("studioCreate.error")
        );
        return;
      }
      router.push(data.sharePath || `/p/${data.shareToken}`);
    } catch {
      setError(t("studioCreate.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-zinc-100">
        {t("studioCreate.title")}
      </h2>
      <p className="mt-1 max-w-xl text-sm text-zinc-500">
        {t("studioCreate.subtitle")}
      </p>

      <form onSubmit={submit} className="mt-5 max-w-lg space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKind("private")}
            className={`px-3 py-1.5 text-sm ${
              kind === "private"
                ? "bg-accent font-medium text-zinc-950"
                : "border border-zinc-700 text-zinc-400"
            }`}
          >
            {t("studioCreate.kindPrivate")}
          </button>
          <button
            type="button"
            onClick={() => setKind("cocreate")}
            className={`px-3 py-1.5 text-sm ${
              kind === "cocreate"
                ? "bg-accent font-medium text-zinc-950"
                : "border border-zinc-700 text-zinc-400"
            }`}
          >
            {t("studioCreate.kindCocreate")}
          </button>
        </div>

        <label className="block text-sm text-zinc-400">
          {t("studioCreate.name")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm text-zinc-400">
          {t("studioCreate.description")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </label>

        {kind === "cocreate" ? (
          <div className="space-y-3 border border-zinc-800 p-4">
            <p className="text-xs font-medium tracking-wide text-zinc-300 uppercase">
              {t("studioCreate.columnSection")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColumnMode("existing")}
                className={`px-3 py-1 text-xs ${
                  columnMode === "existing"
                    ? "bg-zinc-100 text-zinc-950"
                    : "border border-zinc-700 text-zinc-400"
                }`}
              >
                {t("studioCreate.columnExisting")}
              </button>
              <button
                type="button"
                onClick={() => setColumnMode("new")}
                className={`px-3 py-1 text-xs ${
                  columnMode === "new"
                    ? "bg-zinc-100 text-zinc-950"
                    : "border border-zinc-700 text-zinc-400"
                }`}
              >
                {t("studioCreate.columnNew")}
              </button>
            </div>

            {columnMode === "existing" ? (
              myColumns.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  {t("studioCreate.noOwnedColumns")}
                </p>
              ) : (
                <label className="block text-sm text-zinc-400">
                  {t("studioCreate.pickColumn")}
                  <select
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
                  >
                    {myColumns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                  </select>
                </label>
              )
            ) : (
              <>
                <label className="block text-sm text-zinc-400">
                  {t("studioCreate.columnName")}
                  <input
                    value={columnName}
                    onChange={(e) => setColumnName(e.target.value)}
                    required={columnMode === "new"}
                    className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-sm text-zinc-400">
                  {t("studioCreate.columnSlug")}
                  <input
                    value={columnSlug}
                    onChange={(e) => setColumnSlug(e.target.value)}
                    placeholder="my-column"
                    className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
                  />
                </label>
                <p className="text-xs font-medium text-zinc-300">
                  {t("studioCreate.orgSection")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["create", "attach", "none"] as OrgMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOrgMode(m)}
                      className={`px-3 py-1 text-xs ${
                        orgMode === m
                          ? "bg-zinc-100 text-zinc-950"
                          : "border border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {t(ORG_LABEL[m])}
                    </button>
                  ))}
                </div>
                {orgMode === "attach" ? (
                  <label className="block text-sm text-zinc-400">
                    {t("studioCreate.acnOrgId")}
                    <input
                      value={acnOrgId}
                      onChange={(e) => setAcnOrgId(e.target.value)}
                      required
                      className="mt-1 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
                    />
                  </label>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="bg-accent px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t("studioCreate.submitting") : t("studioCreate.submit")}
        </button>
      </form>
    </section>
  );
}
