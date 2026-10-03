import { Platform } from 'react-native';
import { Capacitor } from '@capacitor/core';
import { Haptics as NativeHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import * as Haptics from 'expo-haptics';

export type HapticKind = 'light' | 'success' | 'error';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Fires a short haptic where the platform has one, and does nothing elsewhere.
 *
 * The iOS and Android apps are the web build inside Capacitor, so to React
 * Native they look like a browser (`Platform.OS === 'web'`), where Expo's
 * haptics do nothing. Inside Capacitor the taps go through its own haptics
 * plugin to the phone's Taptic Engine or vibrator instead. A plain browser
 * gets nothing: the web's vibration API is a blunt buzz, not a tap.
 */
export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'light') void NativeHaptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      else
        void NativeHaptics.notification({
          type: kind === 'success' ? NotificationType.Success : NotificationType.Error,
        }).catch(() => {});
      return;
    }
    if (Platform.OS === 'web') return;
    if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Haptics are a nicety; never let them break a move.
  }
}
