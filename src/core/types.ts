/** A playable sovereign country. */
export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania';

export interface Country {
  /** ISO 3166-1 alpha-2, the identifier used everywhere in the game. */
  iso2: string;
  iso3: string;
  /** Canonical display name. */
  name: string;
  /** Regional-indicator flag emoji. */
  flag: string;
  /** Lower-cased common names, abbreviations and former names. */
  aliases: string[];
  /** ISO codes of countries sharing a land border. Always symmetric. */
  neighbours: string[];
  /** Nearby countries across open water, nearest first. */
  crossings: { iso2: string; km: number }[];
  /**
   * Everywhere flight mode can reach from here: the nearest sea crossing,
   * and every other hub if this is one. Only flight mode uses these; every
   * other mode is land borders alone.
   */
  flights: { iso2: string; km: number }[];
  /** A hub airport: in flight mode, it flies to every other hub. */
  hub: boolean;
  /**
   * A territory rather than a sovereign state: Gibraltar, Greenland, Hong
   * Kong. Playable as somewhere to pass through and stamp, never as a start
   * or a destination.
   */
  territory?: true;
  /** The state a territory belongs to, where that is not disputed. */
  sovereign?: string;
  population: number;
  /** Which page of the passport the country's stamp goes on. */
  continent: Continent;
  /** Projected map coordinates of the country's centre. */
  centroid: [number, number];
  /**
   * Projected point where the traveller stands: on the country's largest
   * landmass, as far from any edge as possible. Unlike the centroid, always on
   * land -- the centroid of Japan or Indonesia is in the sea.
   */
  anchor: [number, number];
  /** Projected bounding box: [minX, minY, maxX, maxY]. */
  bbox: [number, number, number, number];
  /** Spherical area x 10^4 steradians. Used for weighting and zoom levels. */
  area: number;
}

/** One drawable shape on the map; `playable` shapes are countries, the rest territories. */
export interface MapShape {
  key: string;
  d: string;
  playable: boolean;
}

export interface WorldData {
  width: number;
  height: number;
  countries: Country[];
  shapes: MapShape[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameMode = 'classic' | 'daily' | 'campaign' | 'flight' | 'visa';

export interface GameConfig {
  mode: GameMode;
  /** ISO code the player starts in. */
  start: string;
  /** ISO code the player must reach. */
  destination: string;
  /** Fewest possible moves. Never shown during play. */
  optimalMoves: number;
  difficulty: Difficulty;
  /** Stable identifier for daily games, e.g. "2026-09-21". */
  dailyKey?: string;
  /** Which campaign level this is, for campaign games. */
  level?: number;
  /** Visa Denied: countries whose border is closed for this game. */
  closed?: string[];
}

export interface GameState {
  config: GameConfig;
  /** Countries occupied so far, in order. Always starts with `config.start`. */
  route: string[];
  /** Every rejected guess, in order. May contain repeats. */
  wrongGuesses: string[];
  /** Hints taken so far. Any at all and the route cannot count as perfect. */
  hints: number;
  /**
   * The hint showing for where the player stands, if any: the country to head
   * for, and whether its name has been given away as well as its outline.
   */
  hint?: { iso2: string; named: boolean };
  status: 'playing' | 'won';
  startedAt: number;
  finishedAt?: number;
}

export type MoveRejection = 'not-adjacent' | 'closed' | 'already-here' | 'finished' | 'unknown-country';

export type MoveResult =
  | { ok: true; state: GameState; won: boolean }
  | { ok: false; reason: MoveRejection; message: string };

export interface GameResult {
  mode: GameMode;
  dailyKey?: string;
  level?: number;
  difficulty: Difficulty;
  route: string[];
  moves: number;
  wrongGuesses: number;
  /** Hints taken. Absent on results saved before hints existed. */
  hints?: number;
  /** Visa Denied: the countries that were closed. */
  closed?: string[];
  seconds: number;
  optimalMoves: number;
  /** True when the player matched the shortest possible route length, unaided. */
  optimal: boolean;
}
