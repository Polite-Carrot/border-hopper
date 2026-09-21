/** A playable sovereign country. */
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
  /** Projected map coordinates of the country's centre. */
  centroid: [number, number];
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

export type GameMode = 'classic' | 'daily';

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
}

export interface GameState {
  config: GameConfig;
  /** Countries occupied so far, in order. Always starts with `config.start`. */
  route: string[];
  /** Every rejected guess, in order. May contain repeats. */
  wrongGuesses: string[];
  status: 'playing' | 'won';
  startedAt: number;
  finishedAt?: number;
}

export type MoveRejection = 'not-adjacent' | 'already-here' | 'finished' | 'unknown-country';

export type MoveResult =
  | { ok: true; state: GameState; won: boolean }
  | { ok: false; reason: MoveRejection; message: string };

export interface GameResult {
  mode: GameMode;
  dailyKey?: string;
  difficulty: Difficulty;
  route: string[];
  moves: number;
  wrongGuesses: number;
  seconds: number;
  optimalMoves: number;
  /** True when the player matched the shortest possible route length. */
  optimal: boolean;
}
