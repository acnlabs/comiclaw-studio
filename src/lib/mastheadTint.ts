/** Deterministic gradient when a series/column has no cover art. */
const TINTS = [
  "from-amber-500/40 via-amber-900/20 to-zinc-950",
  "from-sky-500/40 via-sky-900/20 to-zinc-950",
  "from-violet-500/40 via-violet-900/20 to-zinc-950",
  "from-emerald-500/40 via-emerald-900/20 to-zinc-950",
  "from-rose-500/40 via-rose-900/20 to-zinc-950",
];

export function mastheadTint(key: string): string {
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum = (sum + key.charCodeAt(i)) % 997;
  return TINTS[sum % TINTS.length];
}
