import levelData from '../data/visa-campaign.generated.json';
import { keepBetter, type CampaignProgress } from './campaign';
import type { Difficulty, GameConfig, GameResult } from './types';

export interface VisaLevel {
  level: number;
  start: string;
  destination: string;
  /** Fewest possible moves with the borders closed. Never shown during play. */
  moves: number;
  /** Countries refusing visas on this level. */
  closed: string[];
}

/**
 * The Visa Denied campaign: 100 levels fixed at build time by
 * `scripts/build-visa-campaign.ts`, so everyone plays the same ones. One
 * closed border at first, four by the end, on longer journeys each time.
 */
export const VISA_LEVELS: readonly VisaLevel[] = (levelData as { levels: VisaLevel[] }).levels;

export const VISA_LENGTH = VISA_LEVELS.length;

export function visaLevel(level: number): VisaLevel | undefined {
  return VISA_LEVELS[level - 1];
}

/** As in the random game: one closure is easy, two medium, more hard. */
const difficultyFor = (closed: number): Difficulty => (closed <= 1 ? 'easy' : closed === 2 ? 'medium' : 'hard');

export function visaGame(level: number): GameConfig {
  const entry = visaLevel(level);
  if (!entry) throw new Error(`No Visa Denied level ${level}`);
  return {
    mode: 'visa',
    start: entry.start,
    destination: entry.destination,
    optimalMoves: entry.moves,
    difficulty: difficultyFor(entry.closed.length),
    level,
    closed: [...entry.closed],
  };
}

/** A level opens once the one before it is done. The first is always open. */
export function isVisaLevelUnlocked(progress: CampaignProgress, level: number): boolean {
  if (level < 1 || level > VISA_LENGTH) return false;
  return level === 1 || progress[level - 1] !== undefined;
}

/** The lowest level not yet finished, or null once all are done. */
export function visaNextLevel(progress: CampaignProgress): number | null {
  for (let level = 1; level <= VISA_LENGTH; level++) {
    if (progress[level] === undefined) return level;
  }
  return null;
}

/**
 * Records a finished Visa Denied campaign level, keeping the better attempt.
 * A random Visa Denied game has no level and changes nothing.
 */
export function recordVisaLevel(progress: CampaignProgress, result: GameResult): CampaignProgress {
  if (result.mode !== 'visa' || result.level === undefined) return progress;
  return keepBetter(progress, result.level, result);
}
