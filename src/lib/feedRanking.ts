/**
 * Ordering for the For You feed.
 *
 * The feed used to be every work newest-first, which is not a recommendation —
 * it is a changelog. Three things decide the order now, in this priority:
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
 *
 * What is deliberately missing is personalisation — "what this viewer likes"
 * needs per-viewer history, and the play events being recorded now are the
 * prerequisite for it, not the thing itself.
 */

export const FEATURED_WINDOW_HOURS = 72;
export const FRESH_WINDOW_HOURS = 24;
/** Window the play counts passed to the ranker should cover */
export const HEAT_WINDOW_HOURS = 48;

export type RankableWork = {
  featuredAt: Date | string | null;
  publishedAt: Date | string;
  /** Plays within HEAT_WINDOW_HOURS */
  recentPlays: number;
};

const ms = (v: Date | string) => new Date(v).getTime();
const hoursAgo = (now: number, hours: number) => now - hours * 3600_000;

/** 0 = official pick, 1 = freshly published, 2 = ranked by heat */
export function feedTier(work: RankableWork, now: number): 0 | 1 | 2 {
  if (work.featuredAt && ms(work.featuredAt) >= hoursAgo(now, FEATURED_WINDOW_HOURS)) {
    return 0;
  }
  if (ms(work.publishedAt) >= hoursAgo(now, FRESH_WINDOW_HOURS)) return 1;
  return 2;
}

export function rankForYou<T extends RankableWork>(works: T[], now = Date.now()): T[] {
  return [...works].sort((a, b) => {
    const tierA = feedTier(a, now);
    const tierB = feedTier(b, now);
    if (tierA !== tierB) return tierA - tierB;

    // Within the picks, the most recent pick leads; within fresh, the newest.
    if (tierA === 0) return ms(b.featuredAt!) - ms(a.featuredAt!);
    if (tierA === 1) return ms(b.publishedAt) - ms(a.publishedAt);

    if (a.recentPlays !== b.recentPlays) return b.recentPlays - a.recentPlays;
    return ms(b.publishedAt) - ms(a.publishedAt);
  });
}
