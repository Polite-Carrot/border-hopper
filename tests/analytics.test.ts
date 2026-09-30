import { beforeEach, describe, expect, it } from 'vitest';
import {
  isAnalyticsEnabled, setAnalyticsEnabled, setAnalyticsSink, track,
  type AnalyticsEventName,
} from '../src/core/analytics';

const seen: { name: AnalyticsEventName; params: Record<string, unknown> }[] = [];

const collect = () => {
  setAnalyticsSink((name, params) => {
    seen.push({ name, params: params as Record<string, unknown> });
  });
};

beforeEach(() => {
  seen.length = 0;
  setAnalyticsSink(null);
  setAnalyticsEnabled(false);
});

describe('consent', () => {
  it('is off until something turns it on', () => {
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it('sends nothing at all while consent is off', () => {
    collect();
    track('game_start', {
      mode: 'classic', difficulty: 'easy', optimal_moves: 2, start: 'FR', destination: 'PT',
    });
    track('wrong_guess', { mode: 'classic', from: 'FR', guess: 'JP', reason: 'not-adjacent', moves_in: 0 });
    expect(seen).toEqual([]);
  });

  it('drops what happened before consent rather than saving it up', () => {
    collect();
    track('game_start', {
      mode: 'classic', difficulty: 'easy', optimal_moves: 2, start: 'FR', destination: 'PT',
    });
    // Turning it on must not release what was refused a moment ago: that would
    // be collecting first and asking afterwards.
    setAnalyticsEnabled(true);
    expect(seen).toEqual([]);

    track('onboarding_complete', {});
    expect(seen.map((event) => event.name)).toEqual(['onboarding_complete']);
  });

  it('stops again the moment consent is withdrawn', () => {
    collect();
    setAnalyticsEnabled(true);
    track('onboarding_complete', {});
    setAnalyticsEnabled(false);
    track('onboarding_complete', {});
    expect(seen).toHaveLength(1);
  });
});

describe('never costing anyone their game', () => {
  it('does nothing when there is no backend', () => {
    setAnalyticsEnabled(true);
    expect(() =>
      track('game_complete', {
        mode: 'daily', difficulty: 'medium', moves: 3, optimal_moves: 3, over_par: 0,
        seconds: 42, wrong_guesses: 0, optimal: true,
      })
    ).not.toThrow();
  });

  it('swallows a backend that throws', () => {
    setAnalyticsEnabled(true);
    setAnalyticsSink(() => {
      throw new Error('network on fire');
    });
    expect(() => track('onboarding_complete', {})).not.toThrow();
  });

  it('keeps working after a backend has thrown', () => {
    setAnalyticsEnabled(true);
    let calls = 0;
    setAnalyticsSink(() => {
      calls += 1;
      if (calls === 1) throw new Error('once');
    });
    track('onboarding_complete', {});
    track('onboarding_complete', {});
    expect(calls).toBe(2);
  });
});

describe('the events themselves', () => {
  it('passes the parameters straight through', () => {
    collect();
    setAnalyticsEnabled(true);
    track('game_abandoned', {
      mode: 'campaign', difficulty: 'hard', level: 42, moves_made: 2, optimal_moves: 6,
      seconds: 91, wrong_guesses: 4, stuck_at: 'TD',
    });
    expect(seen[0].name).toBe('game_abandoned');
    expect(seen[0].params).toEqual({
      mode: 'campaign', difficulty: 'hard', level: 42, moves_made: 2, optimal_moves: 6,
      seconds: 91, wrong_guesses: 4, stuck_at: 'TD',
    });
  });

  it('keeps every name inside what GA4 accepts', () => {
    // Names over 40 characters, or starting with a reserved prefix, are
    // rejected on ingest -- silently, which is the worst way to find out.
    const names: AnalyticsEventName[] = [
      'game_start', 'game_complete', 'game_abandoned', 'wrong_guess', 'flight_taken',
      'campaign_complete', 'result_shared', 'onboarding_complete', 'consent_changed',
    ];
    for (const name of names) {
      expect(name.length, name).toBeLessThanOrEqual(40);
      expect(name, name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(/^(firebase_|google_|ga_)/.test(name), name).toBe(false);
    }
  });
});
