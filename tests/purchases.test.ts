import { describe, expect, it } from 'vitest';
import { OWNED_KEY, PRODUCT_ID, createPurchases, type StorePlugin } from '../src/purchases/purchases';

/**
 * Remove Ads against a stand-in for the NativePurchases plugin. `owned` is
 * what the store says the player owns; each test reshapes it as it needs.
 * Ported from Color Sort's tests.
 */
function setup({ platform = 'ios', stored = null as string | null, fail = false } = {}) {
  const calls: [string, unknown?][] = [];
  const storage = new Map<string, string>(stored === null ? [] : [[OWNED_KEY, stored]]);
  const store = {
    owned: [] as string[],
    pending: false,
    fail,
    reject: null as null | { code?: string; message: string },
    listener: null as null | ((t: unknown) => void),
  };
  const plugin: StorePlugin = {
    async getPurchases(options) {
      calls.push(['getPurchases', options]);
      if (store.fail) throw new Error('offline');
      const purchases = store.owned.map((id) => ({ productIdentifier: id, purchaseState: '1' }));
      if (store.pending) purchases.push({ productIdentifier: PRODUCT_ID, purchaseState: '2' });
      return { purchases };
    },
    async restorePurchases() {
      calls.push(['restorePurchases']);
    },
    async getProducts() {
      return { products: [{ priceString: '£1.99', title: 'Remove Ads' }] };
    },
    async purchaseProduct(options) {
      calls.push(['purchaseProduct', options]);
      if (store.reject) throw Object.assign(new Error(store.reject.message), { code: store.reject.code });
      store.owned.push(PRODUCT_ID);
      return { productIdentifier: PRODUCT_ID };
    },
    async addListener(name, listener) {
      calls.push(['addListener', name]);
      store.listener = listener;
      return {};
    },
  };
  const purchases = createPurchases({
    plugin,
    platform: () => platform,
    storage: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => void storage.set(key, value),
    },
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { P: purchases, plugin, store, calls, storage, settle };
}

describe('remove ads', () => {
  it('a fresh install that owns nothing shows ads and the store price', async () => {
    const f = setup();
    await f.P.load();
    f.P.start();
    await f.settle();
    await f.P.refresh();
    expect(f.P.adsRemoved()).toBe(false);
    expect(f.P.status().price).toBe('£1.99');
  });

  it('buying removes ads and is remembered on the device', async () => {
    const f = setup();
    await f.P.refresh();
    expect(await f.P.buy()).toBe('owned');
    expect(f.P.adsRemoved()).toBe(true);
    await f.settle();
    expect(f.storage.get(OWNED_KEY)).toBe('1');
    const buy = f.calls.find((c) => c[0] === 'purchaseProduct')![1] as Record<string, unknown>;
    expect(buy.productIdentifier).toBe('remove_ads');
    expect(buy.isConsumable).toBe(false);
  });

  it('trusts the cache at launch, then the store: iOS asks only for current entitlements', async () => {
    const f = setup({ stored: '1' });
    expect(await f.P.load()).toBe(true);
    await f.P.refresh();
    expect(f.calls.find((c) => c[0] === 'getPurchases')![1]).toEqual({ onlyCurrentEntitlements: true });
    // The store says not owned (refunded): ads come back.
    expect(f.P.adsRemoved()).toBe(false);
    // Launch never brings up the Apple ID sheet.
    expect(f.calls.some((c) => c[0] === 'restorePurchases')).toBe(false);
  });

  it('a failed store query keeps the cached purchase', async () => {
    const f = setup({ stored: '1', fail: true });
    await f.P.load();
    await f.P.refresh();
    expect(f.P.adsRemoved()).toBe(true);
  });

  it('cancelling says cancelled and changes nothing', async () => {
    const f = setup({ platform: 'android' });
    f.store.reject = { code: 'USER_CANCELED', message: 'Purchase is not purchased' };
    expect(await f.P.buy()).toBe('cancelled');
    expect(f.P.adsRemoved()).toBe(false);
    const g = setup();
    g.store.reject = { message: 'User cancelled' };
    expect(await g.P.buy()).toBe('cancelled');
  });

  it('pending payments wait, then unlock on the next check', async () => {
    const f = setup({ platform: 'android' });
    f.store.reject = { message: 'Purchase is pending' };
    expect(await f.P.buy()).toBe('pending');
    expect(f.P.status().pending).toBe(true);
    expect(f.P.adsRemoved()).toBe(false);
    f.store.owned.push(PRODUCT_ID);
    await f.P.refresh();
    expect(f.P.adsRemoved()).toBe(true);
    expect(f.P.status().pending).toBe(false);
  });

  it('an Android purchase still pending at launch shows as pending, not owned', async () => {
    const f = setup({ platform: 'android' });
    f.store.pending = true;
    await f.P.refresh();
    expect(f.P.adsRemoved()).toBe(false);
    expect(f.P.status().pending).toBe(true);
  });

  it('Android acknowledges outstanding purchases before reading them', async () => {
    const f = setup({ platform: 'android' });
    await f.P.refresh();
    const names = f.calls.map((c) => c[0]);
    expect(names.indexOf('restorePurchases')).toBeGreaterThan(-1);
    expect(names.indexOf('restorePurchases')).toBeLessThan(names.indexOf('getPurchases'));
  });

  it('"already owned" on Android turns into a restore', async () => {
    const f = setup({ platform: 'android' });
    f.store.owned.push(PRODUCT_ID);
    f.store.reject = { code: 'ITEM_ALREADY_OWNED', message: 'Purchase is not purchased' };
    expect(await f.P.buy()).toBe('owned');
    expect(f.P.adsRemoved()).toBe(true);
  });

  it('Restore finds a purchase made on another device', async () => {
    const f = setup();
    await f.P.refresh();
    f.store.owned.push(PRODUCT_ID);
    expect(await f.P.restore()).toBe(true);
    expect(f.P.adsRemoved()).toBe(true);
  });

  it('a stale query that started before the purchase cannot undo it', async () => {
    const f = setup();
    await f.P.refresh();
    let release!: () => void;
    const real = f.plugin.getPurchases;
    f.plugin.getPurchases = () => new Promise((resolve) => (release = () => resolve({ purchases: [] })));
    const slow = f.P.refresh();
    f.plugin.getPurchases = real;
    expect(await f.P.buy()).toBe('owned');
    release();
    await slow;
    expect(f.P.adsRemoved()).toBe(true);
  });

  it('iOS listens for Ask to Buy approvals and refunds', async () => {
    const f = setup();
    f.P.start();
    await f.settle();
    expect(f.calls.some((c) => c[0] === 'addListener' && c[1] === 'transactionUpdated')).toBe(true);
    f.store.owned.push(PRODUCT_ID);
    f.store.listener!({});
    await f.settle();
    await f.settle();
    expect(f.P.adsRemoved()).toBe(true);
  });

  it('tells listeners about every change', async () => {
    const f = setup();
    const seen: boolean[] = [];
    f.P.onChange((status) => seen.push(status.owned));
    await f.P.buy();
    expect(seen).toContain(true);
  });

  it('the website has no store', async () => {
    const f = setup({ platform: 'web' });
    expect(f.P.available()).toBe(false);
    expect(await f.P.buy()).toBe('failed');
    f.P.start();
    await f.P.refresh();
    expect(f.calls).toHaveLength(0);
  });
});
