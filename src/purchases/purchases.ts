/**
 * "Remove Ads": one non-consumable in-app purchase, on iOS (StoreKit 2) and
 * Android (Google Play Billing), through @capgo/native-purchases. No server
 * and no account: each store keeps the record of who owns what, and the
 * phone asks it. The same design as Color Sort's.
 *
 * PRODUCT_ID must match, character for character, the product ID created in
 * App Store Connect (In-App Purchases, type Non-Consumable) AND in Google
 * Play Console (Monetize > Products > In-app products). The price shown in
 * the game always comes from the store, in the player's own currency; there
 * is no price here.
 *
 * Where the answer lives:
 *   - The store is the truth. It is asked on every launch and every time the
 *     app comes back to the foreground, so a refund turns ads back on and a
 *     purchase made on another device (or approved later by a parent) turns
 *     them off without anyone pressing Restore.
 *   - OWNED_KEY on the device is only a cache, so an offline launch does not
 *     show an ad to someone who paid. A store query that FAILS leaves the
 *     cache alone; only a query that SUCCEEDS without the product clears it.
 *   - It sits outside the storage module's KEYS on purpose: "Reset all
 *     progress" must never take away something the player paid for.
 *
 * The website has no store: available() is false and nothing is shown.
 */

export const PRODUCT_ID = 'remove_ads';
export const OWNED_KEY = 'borderbound:remove-ads:v1';

/** The handful of plugin calls this needs, typed loosely enough to fake. */
export interface StorePlugin {
  getPurchases(options: { productType?: string; onlyCurrentEntitlements?: boolean }): Promise<{
    purchases: { productIdentifier: string; purchaseState?: string; revocationDate?: string }[];
  }>;
  restorePurchases(): Promise<void>;
  getProducts(options: { productIdentifiers: string[]; productType?: string }): Promise<{
    products: { priceString: string; title?: string }[];
  }>;
  purchaseProduct(options: {
    productIdentifier: string;
    productType?: string;
    isConsumable?: boolean;
  }): Promise<{ productIdentifier?: string }>;
  addListener?(eventName: 'transactionUpdated', listener: (transaction: unknown) => void): Promise<unknown>;
}

export interface PurchaseDeps {
  plugin: StorePlugin;
  /** 'ios', 'android' or 'web'. Asked per call, never fixed at import. */
  platform: () => string;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  clock?: () => number;
}

export interface PurchaseStatus {
  available: boolean;
  owned: boolean;
  /** Paid with a slow method, or waiting on a parent's approval. */
  pending: boolean;
  /** A purchase or restore sheet is up. */
  busy: boolean;
  /** The store's own price string, once it has answered. */
  price: string | null;
}

/**
 * 'owned'     bought now, or already owned (ads are off)
 * 'pending'   waiting on payment or a parent's approval; ads turn off by
 *             themselves once it completes
 * 'cancelled' the player closed the sheet; say nothing
 * 'failed'    anything else
 */
export type BuyResult = 'owned' | 'pending' | 'cancelled' | 'failed';

export interface Purchases {
  available(): boolean;
  /** Reads the cached answer. Call before deciding whether to start ads. */
  load(): Promise<boolean>;
  /** Asks the store for the first time and listens for changes. */
  start(): void;
  adsRemoved(): boolean;
  status(): PurchaseStatus;
  buy(): Promise<BuyResult>;
  /** May show the Apple ID sheet, so only ever from a tap. Resolves to owned or not. */
  restore(): Promise<boolean>;
  /** A silent store query. */
  refresh(): Promise<PurchaseStatus>;
  loadProduct(): Promise<void>;
  onChange(listener: (status: PurchaseStatus) => void): () => void;
}

const warn = (what: string, error: unknown) =>
  console.warn(`Purchases: ${what}:`, (error as { message?: string } | null)?.message ?? error);

export function createPurchases({ plugin, platform, storage, clock = Date.now }: PurchaseDeps): Purchases {
  let owned = false;
  let pending = false;
  let busy = false;
  let price: string | null = null;
  let refreshing: Promise<PurchaseStatus> | null = null;
  let queued: Promise<PurchaseStatus> | null = null;
  /** When buy() last succeeded. */
  let boughtAt = 0;
  let loading: Promise<boolean> | null = null;
  let started = false;
  const listeners = new Set<(status: PurchaseStatus) => void>();

  const available = () => platform() === 'ios' || platform() === 'android';

  const status = (): PurchaseStatus => ({ available: available(), owned, pending, busy, price });

  function emit() {
    const snapshot = status();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        // A broken listener must not stop the others hearing about a purchase.
      }
    }
  }

  function setOwned(on: boolean) {
    if (on) pending = false;
    const changed = on !== owned;
    owned = on;
    void storage.setItem(OWNED_KEY, on ? '1' : '0').catch(() => {});
    if (changed) emit();
  }

  /**
   * Google Play reports purchaseState as a string: "1" purchased, "2"
   * pending. StoreKit's current entitlements leave out refunded and revoked
   * purchases, so on iOS being listed is enough.
   */
  function findOwned(purchases: Awaited<ReturnType<StorePlugin['getPurchases']>>['purchases'] | undefined) {
    let found = false;
    let waiting = false;
    for (const purchase of purchases ?? []) {
      if (!purchase || purchase.productIdentifier !== PRODUCT_ID || purchase.revocationDate) continue;
      if (platform() === 'android') {
        if (purchase.purchaseState === '1') found = true;
        else if (purchase.purchaseState === '2') waiting = true;
      } else {
        found = true;
      }
    }
    return { owned: found, pending: waiting };
  }

  function refresh(): Promise<PurchaseStatus> {
    if (!available()) return Promise.resolve(status());
    // One query at a time; a call that arrives during one runs again after
    // it, so nobody gets an answer to a question asked before whatever they
    // are reacting to (a purchase completing, the app coming back).
    if (refreshing) {
      queued ??= refreshing.then(() => {
        queued = null;
        return refresh();
      });
      return queued;
    }
    const askedAt = clock();
    refreshing = (async () => {
      try {
        if (platform() === 'android') {
          // Picks up purchases that finished while the app was closed (a
          // pending payment that cleared) and acknowledges them: Google
          // refunds any purchase left unacknowledged for three days. Shows
          // nothing to the player on Android.
          try {
            await plugin.restorePurchases();
          } catch {
            // The query below still answers the question.
          }
        }
        const result = await plugin.getPurchases(
          platform() === 'ios' ? { onlyCurrentEntitlements: true } : { productType: 'inapp' }
        );
        const found = findOwned(result?.purchases);
        // A query sent before a purchase finished can come back after it,
        // without the purchase in it. That answer is stale; ignore it.
        if (!found.owned && boughtAt >= askedAt) return status();
        pending = !found.owned && found.pending;
        setOwned(found.owned);
        emit();
      } catch (error) {
        // Offline, or the store is having a moment: keep what we had.
        warn('could not ask the store', error);
      } finally {
        refreshing = null;
      }
      return status();
    })();
    return refreshing;
  }

  async function loadProduct() {
    if (!available() || price) return;
    try {
      const result = await plugin.getProducts({ productIdentifiers: [PRODUCT_ID], productType: 'inapp' });
      const product = result?.products?.[0];
      if (product?.priceString) {
        price = product.priceString;
        emit();
      } else {
        console.warn(`Purchases: the store has no product called ${PRODUCT_ID}`);
      }
    } catch (error) {
      warn('could not load the product', error);
    }
  }

  return {
    available,
    status,
    adsRemoved: () => owned,

    load() {
      loading ??= (async () => {
        try {
          owned = (await storage.getItem(OWNED_KEY)) === '1';
        } catch {
          // Unreadable: the store's answer at launch settles it.
        }
        return owned;
      })();
      return loading;
    },

    start() {
      if (started || !available()) return;
      started = true;
      // iOS reports purchases that complete outside buy(): Ask to Buy
      // approvals, purchases on another device, refunds. Asking the store
      // again is simpler and safer than interpreting each event.
      if (platform() === 'ios' && plugin.addListener) {
        plugin.addListener('transactionUpdated', () => void refresh()).catch((error) => warn('listener failed', error));
      }
      void refresh();
      void loadProduct();
    },

    async buy() {
      if (!available()) return 'failed';
      if (owned) return 'owned';
      if (busy) return 'failed';
      busy = true;
      emit();
      try {
        const transaction = await plugin.purchaseProduct({
          productIdentifier: PRODUCT_ID,
          productType: 'inapp',
          isConsumable: false,
        });
        if (transaction?.productIdentifier === PRODUCT_ID) {
          boughtAt = clock();
          setOwned(true);
        } else {
          await refresh();
        }
        return owned ? 'owned' : 'failed';
      } catch (error) {
        const text = `${(error as { code?: string })?.code ?? ''} ${(error as { message?: string })?.message ?? ''}`;
        if (/USER_CANCEL|cancel/i.test(text)) return 'cancelled';
        if (/pending/i.test(text)) {
          pending = true;
          emit();
          return 'pending';
        }
        if (/ITEM_ALREADY_OWNED/i.test(text)) {
          await refresh();
          return owned ? 'owned' : 'failed';
        }
        console.warn('Purchases: purchase failed:', text);
        return 'failed';
      } finally {
        busy = false;
        emit();
      }
    },

    async restore() {
      if (!available()) return false;
      if (busy) return owned;
      busy = true;
      emit();
      try {
        try {
          await plugin.restorePurchases();
        } catch (error) {
          warn('restore failed', error);
        }
        await refresh();
        return owned;
      } finally {
        busy = false;
        emit();
      }
    },

    refresh,
    loadProduct,

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
