/** 有 handle 才加 @;没有主页就只写展示名,不当成账号。 */
export function authorLine(args: {
  handle?: string | null;
  authorName?: string | null;
}): string | null {
  const handle = args.handle?.trim();
  if (handle) return `@${handle}`;
  const name = args.authorName?.trim();
  return name || null;
}

/** 上架署名只认东家此刻的名字,手填的字不当真。 */
export function pickListingAuthorName(
  liveName: string | null | undefined,
  ...fallbacks: (string | null | undefined)[]
): string | null {
  const live = liveName?.trim();
  if (live) return live;
  for (const fallback of fallbacks) {
    const name = fallback?.trim();
    if (name) return name;
  }
  return null;
}

/** 出演/职员先用 ACN 现名,没有再退回片子上的字,绝不加 @。 */
export function applyLiveCreditNames<T extends { agentId: string; displayName: string }>(
  rows: T[],
  live: ReadonlyMap<string, string>,
): T[] {
  return rows.map((row) => ({
    ...row,
    displayName:
      pickListingAuthorName(live.get(row.agentId), row.displayName) ?? row.agentId,
  }));
}
