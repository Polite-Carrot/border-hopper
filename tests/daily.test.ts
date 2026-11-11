import { describe, expect, it } from 'vitest';
import { VISA_DAILY_FROM, dailyGame, dateKey, isVisaDaily, msUntilNextDaily, nextDateKey, previousDateKey, formatCountdown } from '../src/core/daily';
import { verifyConfig } from '../src/core/generate';
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

  it('has no closed borders before Visa Denied dailies began', () => {
    expect(VISA_DAILY_FROM).toBe('2026-11-12');
    for (const key of ['2026-01-01', '2026-09-21', '2026-11-10', '2026-11-11']) {
      expect(isVisaDaily(key), key).toBe(false);
      expect(dailyGame(key).closed, key).toBeUndefined();
    }
  });

  it('closes borders every other day from then on', () => {
    const days = Array.from({ length: 20 }, (_, i) => dateKey(new Date(2026, 10, 12 + i)));
    days.forEach((key, i) => expect(isVisaDaily(key), key).toBe(i % 2 === 0));
    // Across a month end and a year end, still strictly alternating.
    // 30 November is 18 days on, 1 December 19; 31 December 49, 1 January 50.
    expect(isVisaDaily('2026-11-30')).toBe(true);
    expect(isVisaDaily('2026-12-01')).toBe(false);
    expect(isVisaDaily('2026-12-31')).toBe(false);
    expect(isVisaDaily('2027-01-01')).toBe(true);
  });

  it('makes a Visa Denied daily a proper daily with closed borders, solvable and scored right', () => {
    for (let i = 0; i < 60; i += 2) {
      const key = dateKey(new Date(2026, 10, 12 + i));
      const config = dailyGame(key);
      expect(config.mode, key).toBe('daily');
      expect(config.dailyKey, key).toBe(key);
      expect(config.closed?.length, key).toBeGreaterThan(0);
      expect(config.closed, key).not.toContain(config.start);
      expect(config.closed, key).not.toContain(config.destination);
      expect(verifyConfig(config), key).toBe(true);
      expect(config.optimalMoves).toBeGreaterThan(shortestMoveCount(config.start, config.destination)!);
      expect(dailyGame(key)).toEqual(config);
    }
  });

  it('keeps the days between as ordinary land journeys', () => {
    const key = '2026-11-13';
    expect(dailyGame(key).closed).toBeUndefined();
  });

  it('steps forward a day, across month and year boundaries', () => {
    expect(nextDateKey('2026-11-11')).toBe('2026-11-12');
    expect(nextDateKey('2026-11-30')).toBe('2026-12-01');
    expect(nextDateKey('2026-12-31')).toBe('2027-01-01');
    expect(nextDateKey('2028-02-28')).toBe('2028-02-29');
  });

  it('counts down to local midnight, when the next daily arrives', () => {
    expect(msUntilNextDaily(new Date(2026, 10, 11, 23, 59, 30))).toBe(30_000);
    expect(msUntilNextDaily(new Date(2026, 10, 11, 0, 0, 0))).toBe(24 * 3600_000);
    expect(msUntilNextDaily(new Date(2026, 10, 11, 18, 15, 0))).toBe((5 * 60 + 45) * 60_000);
  });

  it('shows the countdown as hours, minutes and seconds', () => {
    expect(formatCountdown(30_000)).toBe('00:00:30');
    expect(formatCountdown((5 * 3600 + 12 * 60 + 33) * 1000)).toBe('05:12:33');
    expect(formatCountdown(24 * 3600_000)).toBe('24:00:00');
    expect(formatCountdown(1)).toBe('00:00:01');
  });
});
