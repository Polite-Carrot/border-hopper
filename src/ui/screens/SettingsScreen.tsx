import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../../theme';
import type { Settings } from '../../storage/storage';
import { EARLIEST_HOUR, LATEST_HOUR, hourLabel } from '../../reminders';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { ActionRow, SettingRow } from '../components/SettingRow';
import type { PurchaseStatus } from '../../purchases';

export interface SettingsScreenProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onReset: () => void;
  onBack: () => void;
  /** Opens Privacy & data, which is a screen of its own. */
  onPrivacy: () => void;
  /** The daily reminder, or null where there are no notifications (the website). */
  reminder: ReminderSetting | null;
  /** Remove Ads, or null where there is no store (the website). */
  purchase: PurchaseSetting | null;
}

export interface PurchaseSetting {
  status: PurchaseStatus;
  /** The outcome of the last thing the player tried, in place of the usual note. */
  message: string | null;
  onBuy: () => void;
  onRestore: () => void;
  /** Which store, for "this Apple ID" or "this Google account". */
  platform: string;
}

export const REMOVE_ADS_NOTE = 'Pay once, no more ads. Stays removed if you reinstall or change phone.';
export const REMOVE_ADS_OWNED = 'Thank you! Ads are gone for good.';
export const REMOVE_ADS_PENDING =
  'Waiting for the payment to be approved. Ads switch off by themselves when it goes through.';

export interface ReminderSetting {
  on: boolean;
  hour: number;
  /** Notifications are turned off for the game in the phone's own settings. */
  blocked: boolean;
  onToggle: (on: boolean) => void;
  onHour: (hour: number) => void;
}

const REMINDER_NOTE = 'One notification when the daily challenge is ready. Skipped on days you have already finished it.';
const REMINDER_BLOCKED =
  'Notifications are turned off for Border Hopper. Switch this on to open your phone’s settings and allow them.';

export function SettingsScreen({
  settings, onChange, onReset, onBack, onPrivacy, reminder, purchase,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ScreenHeader title="Settings" onBack={onBack} />

        <Text style={styles.section}>GAME</Text>
        <View style={styles.card}>
          <SettingRow
            label="Haptics"
            hint="Vibrate on moves and mistakes"
            value={settings.haptics}
            onChange={(haptics) => onChange({ ...settings, haptics })}
          />
          <SettingRow
            label="Sound"
            hint="A hop at each border, a jingle when you arrive"
            value={settings.sound}
            onChange={(sound) => onChange({ ...settings, sound })}
          />
          <SettingRow
            label="Reduce motion"
            hint="No camera travel, and no jumping about"
            value={settings.reduceMotion}
            onChange={(reduceMotion) => onChange({ ...settings, reduceMotion })}
          />
        </View>

        {reminder ? (
          <>
            <Text style={styles.section}>DAILY REMINDER</Text>
            <View style={styles.card}>
              <SettingRow
                label="Daily reminder"
                hint={reminder.blocked ? REMINDER_BLOCKED : REMINDER_NOTE}
                // A reminder the phone will not deliver is not on, whatever was chosen.
                value={reminder.on && !reminder.blocked}
                onChange={reminder.onToggle}
              />
              {reminder.on && !reminder.blocked ? <HourPicker hour={reminder.hour} onChange={reminder.onHour} /> : null}
            </View>
          </>
        ) : null}

        {purchase ? <RemoveAdsRows purchase={purchase} /> : null}

        <Text style={styles.section}>PRIVACY &amp; DATA</Text>
        <Button label="Usage data and ads" icon="settings" onPress={onPrivacy} />
        <Text style={styles.note}>
          {settings.analytics || settings.personalisedAds
            ? 'Some sharing is switched on.'
            : 'Nothing is being shared.'}
        </Text>

        <Text style={styles.section}>RESET</Text>
        <Button
          label={confirmingReset ? 'Tap again to erase everything' : 'Reset all progress'}
          onPress={() => {
            if (confirmingReset) {
              onReset();
              setConfirmingReset(false);
            } else {
              setConfirmingReset(true);
            }
          }}
        />
        <Text style={styles.note}>
          Your statistics, settings, campaign and tour progress, and passport are stored on this device.
          There is no account, so a reset cannot be undone.
          {reminder ? ' The daily reminder stays as it is.' : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Remove Ads, and the Restore button Apple requires beside anything bought
 * once. The price is the store's own string, in the player's currency.
 */
function RemoveAdsRows({ purchase }: { purchase: PurchaseSetting }) {
  const { status, message, onBuy, onRestore, platform } = purchase;
  const action = status.owned ? 'Removed' : status.pending ? 'Pending' : status.busy ? '…' : (status.price ?? 'Remove');
  const note =
    message ?? (status.owned ? REMOVE_ADS_OWNED : status.pending ? REMOVE_ADS_PENDING : REMOVE_ADS_NOTE);
  return (
    <>
      <Text style={styles.section}>ADS</Text>
      <View style={styles.card}>
        <ActionRow
          label="Remove ads"
          hint={note}
          action={action}
          actionLabel={status.owned ? 'Ads removed' : status.price ? `Remove ads for ${status.price}` : 'Remove ads'}
          onPress={onBuy}
          disabled={status.owned || status.pending || status.busy}
        />
        <View style={styles.divider} />
        <ActionRow
          label="Bought it already?"
          hint={`Restores Remove Ads bought on this ${platform === 'ios' ? 'Apple ID' : 'Google account'}.`}
          action="Restore"
          actionLabel="Restore purchases"
          onPress={onRestore}
          disabled={status.owned || status.busy}
        />
      </View>
    </>
  );
}

/** "Remind me at" with a step either side: 7am to 10pm, an hour at a time. */
function HourPicker({ hour, onChange }: { hour: number; onChange: (hour: number) => void }) {
  const step = (by: number) => {
    const next = Math.min(LATEST_HOUR, Math.max(EARLIEST_HOUR, hour + by));
    if (next !== hour) onChange(next);
  };
  return (
    <View
      style={styles.hourRow}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Remind me at"
      accessibilityValue={{ text: hourLabel(hour) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Text style={styles.hourLabel}>Remind me at</Text>
      <View style={styles.stepper}>
        <StepButton icon="minus" label="Earlier" disabled={hour <= EARLIEST_HOUR} onPress={() => step(-1)} />
        <Text style={styles.hourValue}>{hourLabel(hour)}</Text>
        <StepButton icon="plus" label="Later" disabled={hour >= LATEST_HOUR} onPress={() => step(1)} />
      </View>
    </View>
  );
}

function StepButton({
  icon, label, disabled, onPress,
}: { icon: 'minus' | 'plus'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.step, disabled && styles.stepDisabled, pressed && styles.stepPressed]}
    >
      <Icon name={icon} size={16} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  section: {
    color: colors.textMuted,
    fontFamily: fonts.display,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  hourLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 15.5, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hourValue: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15.5,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  step: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.35 },
  divider: { height: 1, backgroundColor: colors.hairline },
  stepPressed: { backgroundColor: colors.hairline },
  note: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.md, textAlign: 'center', lineHeight: 18 },
});
