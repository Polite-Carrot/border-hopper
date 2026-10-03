import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Image } from 'react-native-svg';
import { colors } from '../../theme';
import { flagImage } from '../flags';

export interface FlagProps {
  iso: string;
  /** Width in pixels; the height follows at the flags' 3:2. */
  width: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A country's flag, drawn from the same artwork the explorer wears, so the
 * flag picked in the passport is exactly the one that ends up on his jumper.
 */
function FlagComponent({ iso, width, style }: FlagProps) {
  const href = flagImage(iso);
  const height = Math.round((width * 2) / 3);
  return (
    <View style={[styles.frame, { width, height }, style]}>
      {href ? (
        <Svg width={width} height={height}>
          <Image href={href} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
        </Svg>
      ) : null}
    </View>
  );
}

export const Flag = memo(FlagComponent);

const styles = StyleSheet.create({
  frame: {
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.land,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
});
