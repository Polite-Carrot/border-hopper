import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dateKey, formatCountdown, isVisaDaily, msUntilNextDaily, nextDateKey } from '../../core/daily';
import { colors, fonts, radius, spacing } from '../../theme';
import { Icon } from './Icon';

/**
 * How long until the next daily, and what kind it is -- shown once today's is
 * done, so there is something to come back for. Ticks once a second on its
 * own; nothing around it re-renders.
 */
export function NextDaily() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);
  const tomorrow = nextDateKey(dateKey(now));
  const visa = isVisaDaily(tomorrow);
  const left = formatCountdown(msUntilNextDaily(now));
  return (
    <View style={styles.box} accessibilityLabel={`Next daily in ${left}${visa ? ', a Visa Denied one' : ''}`}>
      <Text style={styles.label}>NEXT DAILY IN</Text>
      <Text style={styles.time}>{left}</Text>
      <View style={styles.kind}>
        <Icon name={visa ? 'noentry' : 'calendar'} size={13} color={visa ? colors.danger : colors.textMuted} />
        <Text style={[styles.kindText, visa && styles.visa]}>
          {visa ? 'Tomorrow is Visa Denied: some borders closed' : 'Tomorrow is a land-border journey'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  label: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  time: { color: colors.text, fontFamily: fonts.display, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  kindText: { color: colors.textMuted, fontSize: 12.5 },
  visa: { color: '#FFB3B5' },
});
