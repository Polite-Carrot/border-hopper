import { memo } from 'react';
import { G, Path } from 'react-native-svg';
import { mapColors } from '../../theme';
import { BASE_SHAPES } from './shapes';

/**
 * Every country and territory at rest.
 *
 * This renders once and is then left alone: highlights for the current,
 * visited and destination countries are drawn as a thin layer on top, so
 * moving never re-renders two hundred paths.
 */
function BaseLayerComponent() {
  return (
    <G>
      {BASE_SHAPES.map((shape) => (
        <Path
          key={shape.key}
          d={shape.d}
          fill={shape.playable ? mapColors.land : mapColors.territory}
          stroke={mapColors.stroke}
          strokeWidth={0.7}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </G>
  );
}

export const BaseLayer = memo(BaseLayerComponent);
