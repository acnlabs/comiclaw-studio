import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";
import { checkAdminKey, unauthorized } from "@/lib/auth";
import { assertAdminSameOrigin } from "@/lib/adminOrigin";

export { assertAdminSameOrigin };

/** Browser ops session via HttpOnly ADMIN_KEY cookie (not STUDIO_API_KEY). */
export async function requireAdminSession(): Promise<true | Response> {
  const store = await cookies();
  if (!checkAdminKey(store.get(ADMIN_COOKIE)?.value)) return unauthorized();
  return true;
}

export function withAdminSession<Ctx>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>,
  opts?: { mutate?: boolean }
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const method = req.method.toUpperCase();
    const isMutating =
      opts?.mutate ?? !["GET", "HEAD", "OPTIONS"].includes(method);
    if (isMutating) {
      const originOk = assertAdminSameOrigin(req);
      if (originOk) return originOk;
    }
    const ok = await requireAdminSession();
    if (ok instanceof Response) return ok;
    return handler(req, ctx);
  };
}
