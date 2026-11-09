import levelData from '../data/campaign.generated.json';
import { difficultyFor } from './generate';
import type { GameConfig, GameResult } from './types';

export interface CampaignLevel {
  level: number;
  start: string;
  destination: string;
  /** Fewest possible moves. Never shown during play. */
  moves: number;
}

/**
 * The campaign ladder, fixed at build time by `scripts/build-campaign.ts` so
 * every player climbs the same levels in the same order. The first thousand
 * get harder two ways at once -- routes grow from two moves to twelve, and
 * the countries at either end get steadily less familiar -- and the second
 * thousand come in waves, ending on the longest walk on the map.
 */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = (levelData as { levels: CampaignLevel[] }).levels;

export const CAMPAIGN_LENGTH = CAMPAIGN_LEVELS.length;

export function campaignLevel(level: number): CampaignLevel | undefined {
  return CAMPAIGN_LEVELS[level - 1];
}

export function campaignGame(level: number): GameConfig {
  const entry = campaignLevel(level);
  if (!entry) throw new Error(`No campaign level ${level}`);
  return {
    mode: 'campaign',
    start: entry.start,
    destination: entry.destination,
    optimalMoves: entry.moves,
    difficulty: difficultyFor(entry.moves),
    level,
  };
}

/** Best result per completed level, keyed by level number. */
export type CampaignProgress = Record<number, { moves: number; seconds: number; optimal: boolean }>;

export function isLevelComplete(progress: CampaignProgress, level: number): boolean {
  return progress[level] !== undefined;
}

/** A level opens once the one before it is done. The first is always open. */
export function isLevelUnlocked(progress: CampaignProgress, level: number): boolean {
  if (level < 1 || level > CAMPAIGN_LENGTH) return false;
  return level === 1 || isLevelComplete(progress, level - 1);
}

export function completedCount(progress: CampaignProgress): number {
  return Object.keys(progress).length;
}

/** The lowest level not yet finished, or null once the campaign is done. */
export function nextLevel(progress: CampaignProgress): number | null {
  for (let level = 1; level <= CAMPAIGN_LENGTH; level++) {
    if (!isLevelComplete(progress, level)) return level;
  }
  return null;
}

/**
 * Records a finished level, keeping the better attempt so replaying can only
 * improve a score, never lose one.
 */
export function recordLevel(progress: CampaignProgress, result: GameResult): CampaignProgress {
  if (result.mode !== 'campaign' || result.level === undefined) return progress;
  return keepBetter(progress, result.level, result);
}

/**
 * Stores `result` as `level`'s score unless the score already there is
 * better. Shared by every ladder of levels: the campaign and Visa Denied.
 */
export function keepBetter(progress: CampaignProgress, level: number, result: GameResult): CampaignProgress {
  const previous = progress[level];
  const better =
    !previous ||
    result.moves < previous.moves ||
    (result.moves === previous.moves && result.seconds < previous.seconds);
  if (!better) return progress;
  return {
    ...progress,
    // A star once earned stays: a faster replay with a hint is a better time,
    // not a reason to take the unaided perfect route away.
    [level]: { moves: result.moves, seconds: result.seconds, optimal: result.optimal || Boolean(previous?.optimal) },
  };
}
