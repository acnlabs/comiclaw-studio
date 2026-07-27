import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { translate, type MessageKey } from "@/lib/i18n";
import { checkAdminKey } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";
import OrgJoinOpsPanel from "@/components/studio/OrgJoinOpsPanel";
import AdminLogin from "@/components/AdminLogin";

export const dynamic = "force-dynamic";

type Search = Promise<{ columnSlug?: string; status?: string }>;

export default async function StudioOrgJoinsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const locale = await getLocale();
  const t = (key: MessageKey, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const cookieStore = await cookies();
  const isAdmin = checkAdminKey(cookieStore.get(ADMIN_COOKIE)?.value);
  const sp = await searchParams;
  const columnSlug = sp.columnSlug?.trim() || "ai-journal";
  const status = sp.status?.trim() || "pending";

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="text-xs tracking-widest text-accent">COMICLAW STUDIO</div>
        <h1 className="mt-2 text-3xl font-bold text-zinc-50">
          {t("studioOrgJoins.title")}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-400">
          {t("studioOrgJoins.loginHint")}
        </p>
        <AdminLogin />
      </div>
    );
  }

  const requests = await prisma.orgJoinRequest.findMany({
    where: {
      ...(status !== "all" ? { status } : {}),
      ...(columnSlug !== "all" ? { column: { slug: columnSlug } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      column: { select: { slug: true, name: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-accent">COMICLAW STUDIO</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-50">
            {t("studioOrgJoins.title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            {t("studioOrgJoins.intro")}
          </p>
        </div>
        <Link
          href="/studio"
          className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          {t("studioOrgJoins.backStudio")}
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        <Link
          href={`/studio/org-joins?columnSlug=${encodeURIComponent(columnSlug)}&status=pending`}
          className={
            status === "pending" ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
          }
        >
          {t("studioOrgJoins.filterPending")}
        </Link>
        <Link
          href={`/studio/org-joins?columnSlug=${encodeURIComponent(columnSlug)}&status=all`}
          className={
            status === "all" ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
          }
        >
          {t("studioOrgJoins.filterAll")}
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="/studio/org-joins?columnSlug=ai-journal&status=pending"
          className={
            columnSlug === "ai-journal"
              ? "text-accent"
              : "text-zinc-500 hover:text-zinc-300"
          }
        >
          ai-journal
        </Link>
        <Link
          href="/studio/org-joins?columnSlug=all&status=pending"
          className={
            columnSlug === "all" ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
          }
        >
          {t("studioOrgJoins.filterAllColumns")}
        </Link>
      </div>

      <OrgJoinOpsPanel
        requests={requests.map((r) => ({
          id: r.id,
          acnOrgId: r.acnOrgId,
          agentId: r.agentId,
          status: r.status,
          note: r.note,
          decisionNote: r.decisionNote,
          columnSlug: r.column?.slug ?? null,
          columnName: r.column?.name ?? null,
          createdAt: r.createdAt.toISOString(),
        }))}
        labels={{
          empty: t("studioOrgJoins.empty"),
          approve: t("studioOrgJoins.approve"),
          reject: t("studioOrgJoins.reject"),
          rejecting: t("studioOrgJoins.rejecting"),
          noteLabel: t("studioOrgJoins.noteLabel"),
          decisionPlaceholder: t("studioOrgJoins.decisionPlaceholder"),
          agentLabel: t("studioOrgJoins.agentLabel"),
          columnLabel: t("studioOrgJoins.columnLabel"),
          orgLabel: t("studioOrgJoins.orgLabel"),
          errorGeneric: t("studioOrgJoins.errorGeneric"),
        }}
      />
    </div>
  );
}
