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
