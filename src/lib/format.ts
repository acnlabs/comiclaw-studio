const fmt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return fmt.format(new Date(iso));
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  return `${Number(seconds.toFixed(1))}s`;
}
