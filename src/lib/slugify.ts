const SLUG_MAX = 80;

/** Lowercase kebab slug for column URLs; empty if nothing usable remains. */
export function slugifyLabel(raw: string): string {
  return clipSlug(
    raw
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-"),
  );
}

export function fallbackColumnSlug(now = Date.now()): string {
  return `c-${now.toString(36)}`;
}

function clipSlug(value: string): string {
  return value.replace(/^-+|-+$/g, "").slice(0, SLUG_MAX).replace(/-+$/g, "");
}

/**
 * Pick a free workspace slug. Chinese names often collapse to a short
 * remnant (「发现走查-0821」→ 0821); if that remnant is taken, append -2, -3…
 */
export async function firstFreeColumnSlug(
  preferred: string,
  isTaken: (slug: string) => Promise<boolean>,
  now = Date.now(),
): Promise<string> {
  const stem = slugifyLabel(preferred) || fallbackColumnSlug(now);
  if (!(await isTaken(stem))) return stem;
  for (let n = 2; n <= 30; n++) {
    const suffix = `-${n}`;
    const next = clipSlug(stem.slice(0, SLUG_MAX - suffix.length) + suffix);
    if (next && !(await isTaken(next))) return next;
  }
  const extra = `-${now.toString(36)}`;
  return clipSlug(`${stem.slice(0, SLUG_MAX - extra.length)}${extra}`);
}
