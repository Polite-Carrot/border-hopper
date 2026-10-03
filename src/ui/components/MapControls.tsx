import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';
import { Icon, type IconName } from './Icon';

const BUTTON = 40;
const GAP = 8;
/** How much room the controls take, for anything that has to stay clear of them. */
export const MAP_CONTROLS_SIZE = { width: BUTTON, height: BUTTON * 3 + GAP + 5 };

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecentre: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Only worth pressing once the map has been moved off the camera's framing. */
  canRecentre: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Zoom in, zoom out, and back to where the camera put things.
 *
 * Pinch and the scroll wheel do the same, but a player who does not think to
 * pinch -- or is holding the phone in one hand -- needs a way to step back and
 * see the whole world. Re-centre sits apart from the zoom pair because it
 * answers a different question: not "how close", but "where am I".
 */
export function MapControls({
  onZoomIn, onZoomOut, onRecentre, canZoomIn, canZoomOut, canRecentre, style,
}: MapControlsProps) {
  return (
    <View style={[styles.stack, style]} pointerEvents="box-none">
      <View style={styles.pair}>
        <ControlButton icon="plus" label="Zoom in" onPress={onZoomIn} enabled={canZoomIn} />
        <View style={styles.divider} />
        <ControlButton icon="minus" label="Zoom out" onPress={onZoomOut} enabled={canZoomOut} />
      </View>
      <View style={styles.single}>
        <ControlButton icon="target" label="Re-centre the map" onPress={onRecentre} enabled={canRecentre} />
      </View>
    </View>
  );
}

/**
 * On the web a clicked button keeps keyboard focus, and a focused button takes
 * Enter for itself: type a country, press Enter, and the map zooms instead of
 * travelling. So a tap or click lets go of focus afterwards. A press that came
 * from the keyboard keeps it, so someone driving the controls by keyboard can
 * press again.
 */
function releaseFocus(event: GestureResponderEvent) {
  if (Platform.OS !== 'web') return;
  const type = (event?.nativeEvent as unknown as { type?: string } | undefined)?.type ?? '';
  if (type.startsWith('key')) return;
  (globalThis.document?.activeElement as HTMLElement | null | undefined)?.blur?.();
}

function ControlButton({
  icon, label, onPress, enabled,
}: { icon: IconName; label: string; onPress: () => void; enabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      aria-disabled={!enabled}
      disabled={!enabled}
      onPress={(event) => {
        onPress();
        releaseFocus(event);
      }}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={icon} size={18} color={enabled ? colors.current : colors.textFaint} />
    </Pressable>
  );
}

const card = {
  backgroundColor: colors.surfaceSolid,
  borderWidth: 1,
  borderColor: colors.hairlineStrong,
  overflow: 'hidden',
} as const;

const styles = StyleSheet.create({
  stack: { position: 'absolute', gap: GAP, width: BUTTON },
  pair: { ...card, borderRadius: radius.md },
  single: { ...card, borderRadius: radius.pill },
  divider: { height: 1, backgroundColor: colors.hairline },
  button: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
