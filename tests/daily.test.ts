import { describe, expect, it } from 'vitest';
import { dailyGame, dateKey, previousDateKey } from '../src/core/daily';
import { shortestMoveCount } from '../src/core/graph';

describe('daily challenge', () => {
  it('formats a local calendar date key', () => {
    expect(dateKey(new Date(2026, 8, 21))).toBe('2026-09-21');
    expect(dateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('steps back a day, across month and year boundaries', () => {
    expect(previousDateKey('2026-09-21')).toBe('2026-09-20');
    expect(previousDateKey('2026-09-01')).toBe('2026-08-31');
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
    expect(previousDateKey('2024-03-01')).toBe('2024-02-29');
  });

  it('gives the same challenge for the same date, every time', () => {
    for (const key of ['2026-09-21', '2026-01-01', '2027-06-15']) {
      const a = dailyGame(key);
      const b = dailyGame(key);
      expect(a).toEqual(b);
      expect(a.mode).toBe('daily');
      expect(a.dailyKey).toBe(key);
    }
  });

  it('gives different dates different challenges', () => {
    const keys = Array.from({ length: 60 }, (_, i) => dateKey(new Date(2026, 0, 1 + i)));
    const pairs = new Set(keys.map((k) => `${dailyGame(k).start}>${dailyGame(k).destination}`));
    expect(pairs.size).toBeGreaterThan(50);
  });

  it('is always solvable and correctly scored', () => {
    for (let i = 0; i < 120; i++) {
      const key = dateKey(new Date(2026, 0, 1 + i));
      const config = dailyGame(key);
      expect(shortestMoveCount(config.start, config.destination), key).toBe(config.optimalMoves);
      expect(config.optimalMoves).toBeGreaterThan(1);
    }
  });

  it('varies difficulty across the year', () => {
    const seen = new Set(
      Array.from({ length: 90 }, (_, i) => dailyGame(dateKey(new Date(2026, 0, 1 + i))).difficulty)
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
