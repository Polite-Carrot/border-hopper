/**
 * When an interstitial may show. The studio's rule, the same as Color Sort's:
 * at least two minutes AND three finished games since the last one -- and
 * the clock starts at launch, so nobody sees an ad in their first two minutes
 * or before their third finished game.
 *
 * Plain data and pure functions, so the rule can be tested without an SDK.
 */
export const MIN_MILLIS = 2 * 60 * 1000;
export const MIN_GAMES = 3;

export interface AdPacing {
  /** When the last ad showed, or when the app started if none has. */
  lastShownAt: number;
  /** Games finished since then. Abandoned games do not count. */
  gamesSinceLast: number;
}

export function startPacing(now: number): AdPacing {
  return { lastShownAt: now, gamesSinceLast: 0 };
}

export function noteGameFinished(pacing: AdPacing): AdPacing {
  return { ...pacing, gamesSinceLast: pacing.gamesSinceLast + 1 };
}

/** Whether an ad may show now, if one is loaded. */
export function adDue(pacing: AdPacing, now: number): boolean {
  return pacing.gamesSinceLast >= MIN_GAMES && now - pacing.lastShownAt >= MIN_MILLIS;
}

/**
 * Whether to start loading one: a game before it could be due, so it is
 * ready by the time it is allowed, without holding an ad for the whole wait.
 */
export function shouldPrepare(pacing: AdPacing): boolean {
  return pacing.gamesSinceLast >= MIN_GAMES - 1;
}

export function noteAdShown(now: number): AdPacing {
  return { lastShownAt: now, gamesSinceLast: 0 };
}
