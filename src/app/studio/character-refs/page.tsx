import Link from "next/link";
import { cookies } from "next/headers";
import { checkAdminKey } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";
import AdminLogin from "@/components/AdminLogin";
import CharacterRefOpsPanel from "@/components/studio/CharacterRefOpsPanel";

export const dynamic = "force-dynamic";

/**
 * Ops page for the character registry cutover.
 *
 * The production database and the AgentPlanet token are already on the server;
 * requiring someone to dig them out and run a script from a laptop is more
 * work and more exposure than a button behind the ops session.
 */
export default async function CharacterRefsPage() {
  const cookieStore = await cookies();
  const isAdmin = checkAdminKey(cookieStore.get(ADMIN_COOKIE)?.value);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-accent">COMICLAW STUDIO</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-50">角色登记迁移</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            把角色的产权登记从 <code>comiclaw:character:{"{角色 id}"}</code> 搬到{" "}
            <code>comiclaw:character:{"{资产 id}"}</code>。一个命名空间只能有一套 id。
            可重复执行，也能续做上一轮没做完的。
          </p>
        </div>
        <Link
          href="/studio"
          className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          返回 Studio
        </Link>
      </div>

      {isAdmin ? (
        <CharacterRefOpsPanel />
      ) : (
        <>
          <p className="mt-6 text-sm text-zinc-400">
            这是运维操作，需要用 ADMIN_KEY 登录。
          </p>
          <AdminLogin />
        </>
      )}
    </div>
  );
}
