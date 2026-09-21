import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { MAP_WIDTH, countryFlag } from '../../core/world';
import { projectToScreen, type Camera, type Stage } from '../map/camera';

export interface OffscreenTargetProps {
  destination: string;
  destinationCentroid: readonly [number, number];
  camera: Camera;
  stage: Stage;
}

const PILL_WIDTH = 56;
const EDGE = PILL_WIDTH / 2 + 8;

/**
 * When the camera is closed in on the player, the destination is usually off
 * screen. This pins a small flag to the edge in its direction so the objective
 * never disappears -- without hinting at the route to it.
 */
export function OffscreenTarget({
  destination,
  destinationCentroid,
  camera,
  stage,
}: OffscreenTargetProps) {
  const { visible } = stage;
  const midX = visible.x + visible.width / 2;
  /**
   * The map wraps, so the destination exists three times over and the arrow
   * should point at whichever copy is actually nearest -- from Kamchatka,
   * Alaska is a short way east, not most of the world west.
   */
  const point = [-1, 0, 1]
    .map((copy) =>
      projectToScreen([destinationCentroid[0] + copy * MAP_WIDTH, destinationCentroid[1]], camera, stage)
    )
    .reduce((best, candidate) =>
      Math.abs(candidate.x - midX) < Math.abs(best.x - midX) ? candidate : best
    );
  const minX = visible.x + EDGE;
  const maxX = visible.x + visible.width - EDGE;
  // Keep clear of the route trail, which sits just above the map area.
  const minY = visible.y + 30;
  const maxY = visible.y + visible.height - EDGE;

  const onScreen = point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  if (onScreen) return null;

  const x = Math.min(maxX, Math.max(minX, point.x));
  const y = Math.min(maxY, Math.max(minY, point.y));
  const angle = Math.atan2(point.y - y, point.x - x);

  return (
    <View pointerEvents="none" style={[styles.wrapper, { left: x - PILL_WIDTH / 2, top: y - 14 }]}>
      <View style={styles.pill}>
        <Text style={styles.flag}>{countryFlag(destination)}</Text>
        <Text style={[styles.arrow, { transform: [{ rotate: `${angle}rad` }] }]}>➤</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', width: PILL_WIDTH, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(40, 12, 24, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 123, 168, 0.6)',
  },
  flag: { fontSize: 13 },
  arrow: { color: colors.destination, fontSize: 10 },
});
