import tourData from '../data/tours.generated.json';
import { dateKey } from './daily';
import { difficultyFor } from './generate';
import type { GameConfig, GameResult } from './types';

export interface TourLevel {
  level: number;
  start: string;
  destination: string;
  /** Fewest possible moves. Never shown during play. */
  moves: number;
}

export interface Tour {
  id: string;
  name: string;
  /** One line for the tours list. */
  blurb: string;
  /** Drawn in the middle of the badge. */
  emoji: string;
  levels: readonly TourLevel[];
}

/**
 * How each tour is presented. The levels themselves are built once by
 * `scripts/build-tours.ts`, so every player gets the same ones.
 */
const META: Record<string, Omit<Tour, 'id' | 'levels'>> = {
  europe: { name: 'Europe', blurb: 'Thirty hops across the most crowded borders on Earth.', emoji: '🏰' },
  africa: { name: 'Africa', blurb: 'From the Mediterranean to the Cape, the long way round.', emoji: '🦁' },
  asia: { name: 'Asia', blurb: 'From the Bosphorus to the Pacific, mountains in the way.', emoji: '🏯' },
  americas: { name: 'The Americas', blurb: 'Canada to Argentina, and everything in between.', emoji: '🦅' },
  'silk-road': { name: 'The Silk Road', blurb: 'Europe to Asia overland, the way the caravans went.', emoji: '🐫' },
};

export const TOURS: readonly Tour[] = (tourData as { tours: { id: string; levels: TourLevel[] }[] }).tours.map(
  ({ id, levels }) => ({ id, levels, ...META[id] })
);

export function tourById(id: string): Tour | undefined {
  return TOURS.find((tour) => tour.id === id);
}

/** Best result per finished level of each tour, and the day each badge was earned. */
export interface ToursProgress {
  levels: Record<string, Record<number, { moves: number; seconds: number; optimal: boolean }>>;
  badges: Record<string, string>;
}

export const EMPTY_TOURS: ToursProgress = { levels: {}, badges: {} };

export function tourGame(id: string, level: number): GameConfig {
  const entry = tourById(id)?.levels[level - 1];
  if (!entry) throw new Error(`No level ${level} in tour ${id}`);
  return {
    mode: 'tour',
    tour: id,
    start: entry.start,
    destination: entry.destination,
    optimalMoves: entry.moves,
    difficulty: difficultyFor(entry.moves),
    level,
  };
}

export function tourDone(progress: ToursProgress, id: string): number {
  return Object.keys(progress.levels[id] ?? {}).length;
}

/** The lowest level of a tour not yet finished, or null once it is all done. */
export function tourNextLevel(progress: ToursProgress, id: string): number | null {
  const tour = tourById(id);
  if (!tour) return null;
  for (let level = 1; level <= tour.levels.length; level++) {
    if (!progress.levels[id]?.[level]) return level;
  }
  return null;
}

/** As in the campaign: a level opens once the one before it is done. */
export function isTourLevelUnlocked(progress: ToursProgress, id: string, level: number): boolean {
  const tour = tourById(id);
  if (!tour || level < 1 || level > tour.levels.length) return false;
  return level === 1 || Boolean(progress.levels[id]?.[level - 1]);
}

/**
 * Records a finished tour level, keeping the better attempt, and awards the
 * tour's badge the first time its last unfinished level is done. Returns the
 * progress unchanged for any other kind of game.
 */
export function recordTourLevel(progress: ToursProgress, result: GameResult, today = dateKey()): ToursProgress {
  const tour = result.mode === 'tour' && result.tour ? tourById(result.tour) : undefined;
  if (!tour || result.level === undefined) return progress;
  const id = tour.id;
  const previous = progress.levels[id]?.[result.level];
  const better =
    !previous ||
    result.moves < previous.moves ||
    (result.moves === previous.moves && result.seconds < previous.seconds);
  if (!better) return progress;
  const levels = {
    ...progress.levels,
    [id]: {
      ...progress.levels[id],
      [result.level]: {
        moves: result.moves,
        seconds: result.seconds,
        optimal: result.optimal || Boolean(previous?.optimal),
      },
    },
  };
  const complete = Object.keys(levels[id]).length === tour.levels.length;
  const badges = complete && !progress.badges[id] ? { ...progress.badges, [id]: today } : progress.badges;
  return { levels, badges };
}

export function badgeCount(progress: ToursProgress): number {
  return TOURS.filter((tour) => progress.badges[tour.id]).length;
}
