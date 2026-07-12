import Link from "next/link";
import { prisma } from "@/lib/db";
import { STAGES } from "@/lib/types";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STAGE_LABEL = new Map<string, string>([
  ...STAGES.map((s) => [s.key, s.label] as [string, string]),
  ["DONE", "完成"],
]);

// 首页:普通访客只看到品牌页;携带管理密钥(?key=<ADMIN_KEY>)才显示项目列表。
// 客户通过 comiclaw 发送的专属链接 /p/<shareToken> 直达自己的项目。
export default async function Home(props: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await props.searchParams;
  const adminKey = process.env.ADMIN_KEY;
  const isAdmin = Boolean(adminKey) && key === adminKey;

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
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
      <div className="text-xs tracking-widest text-accent">COMICLAW STUDIO</div>
      <h1 className="mt-2 text-3xl font-bold text-zinc-50">漫剧大虾 · 创作工作台</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
        集中呈现 15s 智能体宣传短视频的全流程交付物:剧本、资产(角色 / 场景 / 道具)、
        分镜、成片与发行,由 comiclaw 智能体实时推送更新。
      </p>

      {!isAdmin ? (
        <div className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-8">
          <p className="text-sm text-zinc-300">
            请通过 comiclaw 在对话中发给你的专属项目链接访问,例如:
          </p>
          <p className="mt-2 font-mono text-sm text-accent">
            {"<studio 域名>"}/p/{"<你的项目令牌>"}
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            链接与项目一一对应,请勿转发给项目无关人员。
          </p>
        </div>
      ) : (
        <>
          <h2 className="mt-12 mb-4 text-sm font-medium text-zinc-500">
            全部项目(管理视图)
          </h2>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
              还没有项目。comiclaw 通过 API 创建项目后会显示在这里。
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
                        {p.clientName && <>客户:{p.clientName} · </>}
                        更新于 {fmtDate(p.updatedAt.toISOString())}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      {STAGE_LABEL.get(p.currentStage) ?? p.currentStage}
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
