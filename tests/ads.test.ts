import { beforeEach, describe, expect, it } from 'vitest';
import { MIN_GAMES, MIN_MILLIS, adDue, noteAdShown, noteGameFinished, shouldPrepare, startPacing } from '../src/ads/policy';
import { UNITY_CONFIG, createAds } from '../src/ads/ads';

describe('ad pacing', () => {
  it('waits for both two minutes and three finished games', () => {
    let pacing = startPacing(0);
    for (let i = 0; i < MIN_GAMES; i++) pacing = noteGameFinished(pacing);
    expect(adDue(pacing, MIN_MILLIS - 1)).toBe(false); // games, not time
    expect(adDue(pacing, MIN_MILLIS)).toBe(true);
    const fewGames = noteGameFinished(noteGameFinished(startPacing(0)));
    expect(adDue(fewGames, 10 * MIN_MILLIS)).toBe(false); // time, not games
  });

  it('starts the clock at launch, so a new player gets a grace period', () => {
    let pacing = startPacing(1_000_000);
    for (let i = 0; i < MIN_GAMES; i++) pacing = noteGameFinished(pacing);
    expect(adDue(pacing, 1_000_000 + 30_000)).toBe(false);
  });

  it('resets both counters when one shows', () => {
    const after = noteAdShown(500_000);
    expect(after).toEqual({ lastShownAt: 500_000, gamesSinceLast: 0 });
  });

  it('starts loading one game before it could be due', () => {
    expect(shouldPrepare(noteGameFinished(startPacing(0)))).toBe(false);
    expect(shouldPrepare(noteGameFinished(noteGameFinished(startPacing(0))))).toBe(true);
  });
});

/** Stands in for the studio's Unity client. */
function fakeClient(platform = 'ios') {
  const calls: string[] = [];
  const snapshot = {
    platform, ready: false, showing: false, personalized: false, attStatus: null as string | null,
    effectivePersonalized: false, prepared: { interstitial: false, rewarded: false },
  };
  const state = snapshot;
  return {
    calls,
    state: () => snapshot,
    init: async () => { calls.push('init'); state.ready = true; return true; },
    setPersonalized: async (on: boolean) => { calls.push(`personalised:${on}`); state.personalized = on; },
    requestTracking: async () => { calls.push('prompt'); state.attStatus = 'authorized'; return 'authorized'; },
    prepareInterstitial: async () => { calls.push('prepare'); state.prepared.interstitial = true; return { loaded: true }; },
    showInterstitial: async () => { calls.push('show'); state.prepared.interstitial = false; return { shown: true, rewarded: false }; },
  };
}

describe('ads in the game', () => {
  let now: number;
  const clock = () => now;
  beforeEach(() => { now = 0; });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('shows nothing before three games and two minutes, then one ad', async () => {
    const client = fakeClient();
    let shown = 0;
    const ads = createAds(client, clock, () => shown++);
    for (let game = 1; game <= 3; game++) {
      ads.noteGameFinished();
      await settle();
      now += 30_000;
      expect(await ads.maybeShowInterstitial(), `after game ${game}`).toBe(false);
    }
    now = MIN_MILLIS;
    expect(await ads.maybeShowInterstitial()).toBe(true);
    expect(shown).toBe(1);
    // And straight away again: not due.
    ads.noteGameFinished();
    expect(await ads.maybeShowInterstitial()).toBe(false);
  });

  it('never makes the player wait for an ad to load', async () => {
    const client = fakeClient();
    client.prepareInterstitial = async () => {
      client.calls.push('prepare');
      return { loaded: false, reason: 'no fill' };
    };
    const ads = createAds(client, clock);
    for (let i = 0; i < 3; i++) ads.noteGameFinished();
    now = MIN_MILLIS;
    expect(await ads.maybeShowInterstitial()).toBe(false);
    expect(client.calls).not.toContain('show');
  });

  it('applies the saved personalised-ads choice before starting the SDK', async () => {
    const client = fakeClient();
    await createAds(client, clock).start(true);
    expect(client.calls).toEqual(['personalised:true', 'init']);
  });

  it('asks for tracking only when allowed to prompt, and only on iPhone', async () => {
    const client = fakeClient();
    const ads = createAds(client, clock);
    expect(await ads.tracking(false)).toBeNull();
    expect(client.calls).not.toContain('prompt');
    expect(await ads.tracking(true)).toBe('authorized');
    const android = fakeClient('android');
    expect(await createAds(android, clock).tracking(true)).toBeNull();
    expect(android.calls).not.toContain('prompt');
  });

  it('does nothing at all on the website', async () => {
    const client = fakeClient('web');
    const ads = createAds(client, clock);
    await ads.start(true);
    for (let i = 0; i < 5; i++) ads.noteGameFinished();
    now = 10 * MIN_MILLIS;
    expect(await ads.maybeShowInterstitial()).toBe(false);
    expect(client.calls).toEqual([]);
  });

  it('survives the SDK throwing', async () => {
    const client = fakeClient();
    client.showInterstitial = async () => { throw new Error('bridge gone'); };
    const ads = createAds(client, clock);
    for (let i = 0; i < 3; i++) ads.noteGameFinished();
    await settle();
    now = MIN_MILLIS;
    await expect(ads.maybeShowInterstitial()).resolves.toBe(false);
  });

  it('ships real ads with the Border Hopper placements', () => {
    expect(UNITY_CONFIG.testMode).toBe(false);
    expect(UNITY_CONFIG.ios).toEqual({ gameId: '800388470', interstitial: 'BP_Interstitial_iOS' });
    expect(UNITY_CONFIG.android).toEqual({ gameId: '800388471', interstitial: 'BP_Interstitial_Android' });
  });
});
