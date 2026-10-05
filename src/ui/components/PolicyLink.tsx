import { Linking, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { PRIVACY_POLICY_URL } from '../../core/links';
import { colors, fonts } from '../../theme';

/**
 * "Privacy policy", opening the studio's policy outside the game: a new tab on
 * the web, the phone's browser in the apps.
 */
export function PolicyLink({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Opens in your browser"
      onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
      hitSlop={10}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, style]}
    >
      <Text style={styles.text}>Privacy policy</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  text: {
    color: colors.current,
    fontFamily: fonts.body,
    fontSize: 13.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
