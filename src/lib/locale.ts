import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

// 服务端解析语言:cookie 优先,其次 Accept-Language,默认中文
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  if (saved === "zh" || saved === "en") return saved;

  const headerStore = await headers();
  const accept = headerStore.get("accept-language") ?? "";
  if (accept && !/zh/i.test(accept.split(",")[0] ?? "")) return "en";
  return "zh";
}
