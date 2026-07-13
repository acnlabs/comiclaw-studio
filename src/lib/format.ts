import type { Locale } from "@/lib/i18n";

const formatters: Record<Locale, Intl.DateTimeFormat> = {
  zh: new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }),
  en: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }),
};

export function fmtDate(iso: string | null | undefined, locale: Locale = "zh"): string {
  if (!iso) return "—";
  return formatters[locale].format(new Date(iso));
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  return `${Number(seconds.toFixed(1))}s`;
}
