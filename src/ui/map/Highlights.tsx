import { memo } from 'react';
import { G, Path } from 'react-native-svg';
import { mapColors } from '../../theme';
import { PATH_BY_KEY } from './shapes';

export interface HighlightsProps {
  offset: number;
  visited: readonly string[];
  destinationPath?: string;
  currentPath?: string;
  invalidPath?: string;
  hintPath?: string;
  closed?: readonly string[];
}

/** Current, visited, destination, hinted and rejected countries, drawn over one copy of the world. */
export const Highlights = memo(function Highlights({
  offset,
  visited,
  destinationPath,
  currentPath,
  invalidPath,
  hintPath,
  closed,
}: HighlightsProps) {
  return (
    <G translateX={offset}>
      {visited.map((iso) =>
        PATH_BY_KEY[iso] ? (
          <Path
            key={`visited-${iso}`}
            d={PATH_BY_KEY[iso]}
            fill={mapColors.visited}
            stroke={mapColors.stroke}
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
        ) : null
      )}

      {destinationPath ? (
        <Path
          d={destinationPath}
          fill="none"
          stroke={mapColors.destination}
          strokeWidth={2.4}
          strokeOpacity={0.95}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {currentPath ? (
        <>
          {/* A wide translucent stroke reads as a glow at every zoom level. */}
          <Path
            d={currentPath}
            fill="none"
            stroke={mapColors.current}
            strokeOpacity={0.22}
            strokeWidth={14}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <Path
            d={currentPath}
            fill={mapColors.current}
            fillOpacity={0.9}
            stroke={mapColors.currentStroke}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}

      {/* Closed borders: red, and hatched with a dashed edge so they read as
          shut even to someone who cannot tell red from the land around it. */}
      {closed?.map((iso) =>
        PATH_BY_KEY[iso] ? (
          <Path
            key={`closed-${iso}`}
            d={PATH_BY_KEY[iso]}
            fill={mapColors.closed}
            fillOpacity={0.3}
            stroke={mapColors.closed}
            strokeWidth={1.8}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null
      )}

      {hintPath ? (
        <Path
          d={hintPath}
          fill={mapColors.hint}
          fillOpacity={0.18}
          stroke={mapColors.hint}
          strokeWidth={2}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {invalidPath ? (
        <Path
          d={invalidPath}
          fill={mapColors.invalid}
          fillOpacity={0.55}
          stroke={mapColors.invalid}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </G>
  );
});
