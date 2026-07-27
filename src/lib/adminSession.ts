import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";
import { checkAdminKey, unauthorized } from "@/lib/auth";

/** Browser ops session via HttpOnly ADMIN_KEY cookie (not STUDIO_API_KEY). */
export async function requireAdminSession(): Promise<true | Response> {
  const store = await cookies();
  if (!checkAdminKey(store.get(ADMIN_COOKIE)?.value)) return unauthorized();
  return true;
}

export function withAdminSession<Ctx>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const ok = await requireAdminSession();
    if (ok instanceof Response) return ok;
    return handler(req, ctx);
  };
}
