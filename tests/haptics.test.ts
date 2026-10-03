import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The apps run the web build inside Capacitor, where React Native reports
 * "web". These stand-ins pin down that haptics still reach the phone there.
 */
const native = { value: false };
const calls: string[] = [];

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/haptics', () => ({
  ImpactStyle: { Light: 'LIGHT' },
  NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
  Haptics: {
    impact: async ({ style }: { style: string }) => void calls.push(`impact:${style}`),
    notification: async ({ type }: { type: string }) => void calls.push(`notify:${type}`),
  },
}));
vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  impactAsync: async () => void calls.push('expo'),
  notificationAsync: async () => void calls.push('expo'),
}));

const { haptic, setHapticsEnabled } = await import('../src/ui/hooks/useHaptics');

describe('haptics', () => {
  beforeEach(() => {
    calls.length = 0;
    native.value = false;
    setHapticsEnabled(true);
  });

  it('taps the phone inside the iOS and Android apps', () => {
    native.value = true;
    haptic('light');
    haptic('success');
    haptic('error');
    expect(calls).toEqual(['impact:LIGHT', 'notify:SUCCESS', 'notify:ERROR']);
  });

  it('stays still in a plain browser', () => {
    haptic('light');
    haptic('error');
    expect(calls).toEqual([]);
  });

  it('respects the setting being switched off', () => {
    native.value = true;
    setHapticsEnabled(false);
    haptic('success');
    expect(calls).toEqual([]);
  });
});
