/** Newest-first timeline: higher entryOrder first; nulls last; then createdAt desc. */
export function compareEntriesNewestFirst<
  T extends { entryOrder: number | null; createdAt: string | Date },
>(a: T, b: T): number {
  const aNull = a.entryOrder == null;
  const bNull = b.entryOrder == null;
  if (aNull !== bNull) return aNull ? 1 : -1;
  if (!aNull && !bNull && a.entryOrder !== b.entryOrder) {
    return (b.entryOrder as number) - (a.entryOrder as number);
  }
  const at = new Date(a.createdAt).getTime();
  const bt = new Date(b.createdAt).getTime();
  return bt - at;
}

/** Safe http(s) URL for <img src> / CSS — rejects empty and non-http schemes. */
export function safeMediaUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}
