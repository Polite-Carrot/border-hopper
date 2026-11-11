import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { VISA_NOTES } from './visaNotes';

export interface VisaIntroProps {
  onStart: () => void;
}

/**
 * How Visa Denied works, before the first level of its campaign: the map is
 * already showing behind it, closed border and all, so the rules land next to
 * the thing they describe. The clock waits for "Got it".
 */
export function VisaIntro({ onStart }: VisaIntroProps) {
  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Icon name="noentry" size={18} color={colors.danger} />
          <Text style={styles.title} accessibilityRole="header">
            VISA DENIED
          </Text>
        </View>
        <Text style={styles.lead}>Some borders are closed. Here is how it works.</Text>
        <View style={styles.notes}>
          {VISA_NOTES.map((note) => (
            <View key={note.text} style={styles.note}>
              <Text style={styles.noteIcon}>{note.icon}</Text>
              <Text style={styles.noteText}>{note.text}</Text>
            </View>
          ))}
        </View>
        <Button label="Got it" variant="primary" icon="play" onPress={onStart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 10, 18, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.35)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.danger, fontFamily: fonts.display, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  lead: { color: colors.text, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },
  notes: { gap: spacing.md, marginVertical: spacing.xs },
  note: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  noteIcon: { fontSize: 16, lineHeight: 21 },
  noteText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
});
