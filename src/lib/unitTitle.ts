/** Prefix「第 n 记/集」unless the stored name already starts with it. */
export function numberedTitle(
  name: string,
  prefix: string | null | undefined,
): string {
  const trimmed = name.trim();
  if (!prefix) return trimmed;
  if (
    trimmed === prefix ||
    trimmed.startsWith(`${prefix} ·`) ||
    trimmed.startsWith(`${prefix}·`) ||
    trimmed.startsWith(`${prefix}:`) ||
    trimmed.startsWith(`${prefix}：`)
  ) {
    return trimmed;
  }
  return `${prefix} · ${trimmed}`;
}
