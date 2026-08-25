/** Stable Interfaze embed session key. Gateway does not interpret work/plot. */

function asToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  if (!id || id.length > 100 || /[\s\x00-\x1f]/.test(id)) return undefined;
  return id;
}

export function embedSessionContext(
  metadata?: Record<string, unknown> | null,
  explicit?: string | null,
): string | undefined {
  const fromHost = (explicit ?? "").trim();
  if (fromHost) return fromHost;
  const workId = asToken(metadata?.workId);
  if (workId) return `work:${workId}`;
  const plotId = asToken(metadata?.plotId);
  if (plotId) return `plot:${plotId}`;
  return undefined;
}
