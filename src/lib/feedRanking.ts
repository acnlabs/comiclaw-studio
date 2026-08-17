/**
 * Ordering for the For You feed.
 *
 * The feed used to be every work newest-first, which is not a recommendation —
 * it is a changelog. Four things decide the order now, in this priority:
 *
 * 1. **Official picks.** Ops marks a work with `featuredAt`. A pick is honoured
 *    for a window and then expires by itself, so nobody has to remember to
 *    un-pin it.
 * 2. **Fresh publishes.** Anything published very recently rides near the top
 *    regardless of plays. Without this, ranking by heat alone would bury every
 *    new work forever: it starts at zero plays, so it never gets the views it
 *    would need to earn a position.
 * 3. **Real heat.** Everything else sorts by plays in a recent window, then by
 *    publish time as the tiebreak.
 * 4. **Author diversity.** After the score order is fixed, a run of the same
 *    creator is broken *within a tier* so the swipe feed does not stack three
 *    of theirs in a row. Official picks are never swapped with a fresh or
 *    heat item; a different author is only pulled from later in the same tier.
 *
 * What is still missing is personalisation — "what this viewer likes". Play,
 * skip and complete events (with a user id when they are signed in) are the
 * prerequisite for that, not the thing itself.
 */

export const FEATURED_WINDOW_HOURS = 72;
export const FRESH_WINDOW_HOURS = 24;
/** Window the play counts passed to the ranker should cover */
export const HEAT_WINDOW_HOURS = 48;
/** Same creator may occupy this many neighbouring slots, then we look ahead */
export const MAX_AUTHOR_RUN = 2;

export type RankableWork = {
  featuredAt: Date | string | null;
  publishedAt: Date | string;
  /** Plays within HEAT_WINDOW_HOURS */
  recentPlays: number;
  /** Stable creator id. Missing / empty = unique, so diversity leaves it alone. */
  authorKey?: string | null;
};

const ms = (v: Date | string) => new Date(v).getTime();
const hoursAgo = (now: number, hours: number) => now - hours * 3600_000;

/** Owner first, then the appearing agent, then the display name, then the work. */
export function feedAuthorKey(work: {
  id: string;
  ownerKind?: string | null;
  ownerUserId?: string | null;
  ownerAgentId?: string | null;
  ownerOrgId?: string | null;
  appearingAgentId?: string | null;
  authorName?: string | null;
}): string {
  if (work.ownerKind === "user" && work.ownerUserId) return `user:${work.ownerUserId}`;
  if (work.ownerKind === "agent" && work.ownerAgentId) return `agent:${work.ownerAgentId}`;
  if (work.ownerKind === "org" && work.ownerOrgId) return `org:${work.ownerOrgId}`;
  if (work.appearingAgentId) return `appear:${work.appearingAgentId}`;
  const name = work.authorName?.trim().toLowerCase();
  if (name) return `name:${name}`;
  return `work:${work.id}`;
}

/** 0 = official pick, 1 = freshly published, 2 = ranked by heat */
export function feedTier(work: RankableWork, now: number): 0 | 1 | 2 {
  if (work.featuredAt && ms(work.featuredAt) >= hoursAgo(now, FEATURED_WINDOW_HOURS)) {
    return 0;
  }
  if (ms(work.publishedAt) >= hoursAgo(now, FRESH_WINDOW_HOURS)) return 1;
  return 2;
}

function blockedAuthor(out: RankableWork[]): string | null {
  if (out.length < MAX_AUTHOR_RUN) return null;
  const tail = out.slice(-MAX_AUTHOR_RUN);
  const key = tail[0]?.authorKey?.trim();
  if (!key) return null;
  return tail.every((w) => w.authorKey === key) ? key : null;
}

function diversifyRun<T extends RankableWork>(ranked: T[]): T[] {
  const remaining = [...ranked];
  const out: T[] = [];
  while (remaining.length) {
    const blocked = blockedAuthor(out);
    const idx = blocked ? remaining.findIndex((w) => w.authorKey !== blocked) : 0;
    out.push(remaining.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out;
}

/**
 * Keep score order, but do not let one creator occupy more than MAX_AUTHOR_RUN
 * in a row. Only looks ahead inside the same tier, so a pick cannot be
 * displaced by a fresh or heat work.
 */
export function diversifyAuthors<T extends RankableWork>(ranked: T[], now: number): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < ranked.length) {
    const tier = feedTier(ranked[i], now);
    let j = i + 1;
    while (j < ranked.length && feedTier(ranked[j], now) === tier) j += 1;
    out.push(...diversifyRun(ranked.slice(i, j)));
    i = j;
  }
  return out;
}

export function rankForYou<T extends RankableWork>(works: T[], now = Date.now()): T[] {
  const sorted = [...works].sort((a, b) => {
    const tierA = feedTier(a, now);
    const tierB = feedTier(b, now);
    if (tierA !== tierB) return tierA - tierB;

    // Within the picks, the most recent pick leads; within fresh, the newest.
    if (tierA === 0) return ms(b.featuredAt!) - ms(a.featuredAt!);
    if (tierA === 1) return ms(b.publishedAt) - ms(a.publishedAt);

    if (a.recentPlays !== b.recentPlays) return b.recentPlays - a.recentPlays;
    return ms(b.publishedAt) - ms(a.publishedAt);
  });
  return diversifyAuthors(sorted, now);
}
