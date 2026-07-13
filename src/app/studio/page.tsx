import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { translate, type MessageKey } from "@/lib/i18n";
import { checkAdminKey } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";
import StudioHome from "@/components/StudioHome";

export const dynamic = "force-dynamic";

// Studio 入口:普通访客看到介绍页 + 登录框;
// 已登录管理员(HttpOnly Cookie 校验)显示全部项目。
// 客户通过专属链接 /p/<shareToken> 直达自己的项目。
export default async function StudioPage() {
  const locale = await getLocale();
  const t = (key: MessageKey, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const cookieStore = await cookies();
  const isAdmin = checkAdminKey(cookieStore.get(ADMIN_COOKIE)?.value);

  const projects = isAdmin
    ? await prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          clientName: true,
          agentName: true,
          currentStage: true,
          shareToken: true,
          updatedAt: true,
        },
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <div className="text-xs tracking-widest text-accent">COMICLAW STUDIO</div>
      <h1 className="mt-2 text-3xl font-bold text-zinc-50">{t("studio.title")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{t("studio.intro")}</p>

      {!isAdmin ? (
        <StudioHome />
      ) : (
        <>
          <h2 className="mt-12 mb-4 text-sm font-medium text-zinc-500">{t("studio.allProjects")}</h2>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
              {t("studio.noProjects")}
            </div>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/p/${p.shareToken}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 transition-colors hover:border-zinc-700"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-100">{p.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {p.clientName && (
                          <>
                            {t("common.client")}:{p.clientName} ·{" "}
                          </>
                        )}
                        {t("common.updatedAt", { date: fmtDate(p.updatedAt.toISOString(), locale) })}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      {t(`stage.${p.currentStage}` as MessageKey)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
