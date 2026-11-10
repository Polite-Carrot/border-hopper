import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { countryFlag, countryName } from '../../core/world';
import { formatDuration } from '../../core/format';
import { Icon } from './Icon';

export interface GameHudProps {
  destination: string;
  moves: number;
  /** When the game started, and finished if it has: the clock counts between them. */
  startedAt: number;
  finishedAt?: number;
  /** Short label above the destination: the mode, or the campaign level. */
  caption: string;
  onExit: () => void;
}

/** Destination, moves and clock. Nothing else competes with the map. */
export function GameHud({ destination, moves, startedAt, finishedAt, caption, onExit }: GameHudProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to menu"
        onPress={onExit}
        hitSlop={12}
        style={({ pressed }) => [styles.exit, pressed && styles.exitPressed]}
      >
        <Icon name="back" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={styles.target}>
        <Text style={styles.caption}>{caption}</Text>
        <View style={styles.targetRow}>
          <Text style={styles.flag}>{countryFlag(destination)}</Text>
          <Text style={styles.targetName} numberOfLines={1}>
            {countryName(destination).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.counters}>
        <Text style={styles.counter}>{moves}</Text>
        <Text style={styles.counterLabel}>{moves === 1 ? 'move' : 'moves'}</Text>
        <Clock startedAt={startedAt} finishedAt={finishedAt} />
      </View>
    </View>
  );
}

/**
 * The game clock. It ticks on its own, so only this text redraws each
 * second: when the screen held the time, every tick re-rendered the whole
 * game screen, map and all, which an iPhone feels as a hitch once a second.
 */
function Clock({ startedAt, finishedAt }: { startedAt: number; finishedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (finishedAt !== undefined) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [finishedAt]);
  const seconds = Math.max(0, Math.round(((finishedAt ?? now) - startedAt) / 1000));
  return <Text style={styles.clock}>{formatDuration(seconds)}</Text>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  exit: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  exitPressed: { opacity: 0.6 },
  target: { flex: 1, alignItems: 'center' },
  caption: {
    color: colors.textMuted,
    fontFamily: fonts.display,
    fontSize: 9.5,
    letterSpacing: 2,
    fontWeight: '700',
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  flag: { fontSize: 17 },
  targetName: {
    color: colors.destination,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  counters: { minWidth: 52, alignItems: 'flex-end' },
  counter: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 21,
  },
  counterLabel: { color: colors.textMuted, fontSize: 9.5, letterSpacing: 1, fontWeight: '600' },
  clock: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
});
