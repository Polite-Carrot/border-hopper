import { Capacitor } from '@capacitor/core';
import { NativePurchases } from '@capgo/native-purchases';
import { store } from '../storage/backend';
import { createPurchases, type Purchases, type StorePlugin } from './purchases';

let instance: Purchases | null = null;

/** The app's one store client: there is one purchase to own. */
export function getPurchases(): Purchases {
  instance ??= createPurchases({
    plugin: NativePurchases as unknown as StorePlugin,
    platform: () => (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'),
    storage: {
      getItem: (key) => store().getItem(key),
      setItem: (key, value) => store().setItem(key, value),
    },
  });
  return instance;
}

export type { BuyResult, PurchaseStatus } from './purchases';
