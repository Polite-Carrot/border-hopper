/**
 * Optional, consented analytics.
 *
 * One call surface, no backend. `track` hands finished events to whatever
 * `setAnalyticsSink` was given -- a GA4 web stream, the Firebase plugin on a
 * device, both, neither -- so the call sites in the game never learn which,
 * and adding a backend later touches this file only.
 *
 * Two rules the rest of the module exists to keep:
 *
 * Nothing leaves until somebody has said yes. Events raised while consent is
 * off are dropped, not buffered: holding them back in the hope of a later yes
 * would be collecting the data first and asking afterwards, which is the thing
 * consent is for. A player who turns it on is measured from that moment.
 *
 * Nothing here can cost somebody their game. Every call is safe at any time,
 * with no sink, with a sink that throws, before consent, after it is
 * withdrawn. `track` swallows everything -- an analytics failure that stops a
 * player mid-route would be far more expensive than the event is worth.
 */

/**
 * The events, and what each one carries.
 *
 * Names and parameters are snake_case because GA4 is where these end up, and
 * it is stricter than it looks: event names are limited to 40 characters,
 * parameter names to 40, string values to 100, and names beginning `firebase_`,
 * `google_` or `ga_` are reserved. Keeping to short, plain names here means
 * never having to rename a live event, which loses its history.
 */
export interface AnalyticsEvents {
  /** A game begins. `optimal_moves` is the par the player is measured against. */
  game_start: {
    mode: string;
    difficulty: string;
    optimal_moves: number;
    /** Campaign only. */
    level?: number;
    start: string;
    destination: string;
  };

  /** A game is won. `over_par` is 0 for a perfect route and never negative. */
  game_complete: {
    mode: string;
    difficulty: string;
    level?: number;
    moves: number;
    optimal_moves: number;
    over_par: number;
    seconds: number;
    wrong_guesses: number;
    optimal: boolean;
  };

  /**
   * A game is left unfinished. The most valuable event in the set: a finished
   * game tells you what worked, and only this tells you where people give up.
   */
  game_abandoned: {
    mode: string;
    difficulty: string;
    level?: number;
    /** How far they got, which is the whole point of the event. */
    moves_made: number;
    optimal_moves: number;
    seconds: number;
    wrong_guesses: number;
    /** Where they were standing when they quit. */
    stuck_at: string;
  };

  /**
   * A guess the rules refused.
   *
   * This is the event the privacy screen promises: "which countries people get
   * stuck on". `from` is where they were, `guess` is what they tried, and
   * enough of those together say which borders people believe in that do not
   * exist. Not logged when consent is off, like everything else here.
   */
  wrong_guess: {
    mode: string;
    level?: number;
    from: string;
    guess: string;
    reason: string;
    moves_in: number;
  };

  /** A flight was taken rather than a border crossed. Flight mode only. */
  flight_taken: { from: string; to: string; km: number; moves_in: number };

  /** The player got to the end of the 250-level ladder. */
  campaign_complete: { seconds_total: number; perfect_levels: number };

  /** A finished game was shared, and from which mode. */
  result_shared: { mode: string; level?: number; optimal: boolean };

  /** The "how it works" card was dismissed and the first game began. */
  onboarding_complete: Record<string, never>;

  /**
   * A privacy switch was moved. Worth recording *because* it is consented:
   * knowing how many people turn usage data off again is the only honest
   * measure of whether the asking is reasonable.
   */
  consent_changed: { setting: string; enabled: boolean };

  /**
   * A flag put on the explorer, or "default" for his own jumper. Which flags
   * people actually wear says which countries they are proud of, and how many
   * stamps they had says how far into the passport that choice comes.
   */
  skin_changed: { skin: string; stamps: number };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Where finished events go. Returning nothing, and never throwing, is the contract. */
export type AnalyticsSink = <K extends AnalyticsEventName>(
  name: K,
  params: AnalyticsEvents[K]
) => void;

let enabled = false;
let sink: AnalyticsSink | null = null;

/**
 * Turns collection on or off. Driven by the player's own setting, which is the
 * only authority: see `Settings.analytics`.
 */
export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
}

export function isAnalyticsEnabled(): boolean {
  return enabled;
}

/** Installs the backend. Passing null removes it, which makes `track` inert. */
export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
}

/**
 * Records an event, if there is consent and somewhere to send it.
 *
 * Safe to call from anywhere, including a render path or a catch block.
 */
export function track<K extends AnalyticsEventName>(name: K, params: AnalyticsEvents[K]): void {
  if (!enabled || !sink) return;
  try {
    sink(name, params);
  } catch {
    // An analytics backend is never worth a crash.
  }
}
