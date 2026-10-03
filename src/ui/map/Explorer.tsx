import { memo, useId } from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, Image, Path, Rect } from 'react-native-svg';
import { flagImage } from '../flags';

/** On-screen height of the traveller, in pixels, from boots to hat. */
export const TRAVELLER_HEIGHT = 36;
/** The artwork below is drawn 96 units tall. */
const SCALE = TRAVELLER_HEIGHT / 96;

const OUTLINE = '#0B1A2A';
/**
 * Red so he stands out on the bright blue of the country he is standing in.
 * A flag skin is drawn over the top of it, so if one ever fails to load he
 * still has a jumper on.
 */
const JUMPER = '#E5533D';
const JUMPER_PATH = 'M-16 -44 C-16 -52 16 -52 16 -44 L18 -18 C18 -12 -18 -12 -18 -18Z';
/** The jumper's bounding box, which the flag is fitted into. */
const JUMPER_BOX = { x: -18, y: -52, width: 36, height: 40 };

export interface ExplorerProps {
  /** ISO code of the flag on his jumper, or null for his own red one. */
  skin?: string | null;
  /**
   * Which way he faces. Whoever draws him mirrors him to face west; passing
   * that here un-mirrors the flag, so it is never back to front.
   */
  facing?: 1 | -1;
}

/**
 * The explorer: safari hat, backpack, boots.
 *
 * Drawn facing the player with his feet at (0, 0), so whoever places him only
 * has to say where the ground is, and squashing him on landing presses him
 * into the ground rather than shrinking him towards his middle. The backpack
 * hangs off his left, which is the trailing side when he heads east; the map
 * mirrors him to head west, and the backpack follows him round.
 *
 * Every part carries a dark outline so he reads on any country at 36px.
 */
function ExplorerComponent({ skin = null, facing = 1 }: ExplorerProps) {
  // One clip per explorer on screen: there are three on the map, one per
  // wrapped copy of the world, and the passport draws another.
  const clipId = `jumper-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const flag = skin ? flagImage(skin) : undefined;

  return (
    <G scale={SCALE}>
      {flag ? (
        <Defs>
          <ClipPath id={clipId}>
            <Path d={JUMPER_PATH} />
          </ClipPath>
        </Defs>
      ) : null}
      <G stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
        {/* Backpack, behind everything. */}
        <Rect x={-30} y={-52} width={20} height={30} rx={6} fill="#C9813D" />
        {/* Legs and boots. */}
        <Path d="M-7 -14 L-8 -4 M7 -14 L8 -4" fill="none" strokeWidth={7} />
        <Ellipse cx={-10} cy={-3} rx={8} ry={5} fill="#3A2A22" />
        <Ellipse cx={10} cy={-3} rx={8} ry={5} fill="#3A2A22" />
        {/* Jumper, with the flag cut to its shape, then its outline again on top. */}
        <Path d={JUMPER_PATH} fill={JUMPER} />
      </G>
      {flag ? (
        <G clipPath={`url(#${clipId})`}>
          <G scaleX={facing}>
            {/* Cropped rather than squashed to fit: a stretched flag turns
                Japan's sun into an egg. The middle of a flag is the part
                that says which one it is. */}
            <Image
              href={flag}
              x={JUMPER_BOX.x}
              y={JUMPER_BOX.y}
              width={JUMPER_BOX.width}
              height={JUMPER_BOX.height}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        </G>
      ) : null}
      <G stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
        <Path d={JUMPER_PATH} fill="none" />
        {/* Head, then the hat: brim, crown and band. */}
        <Circle cx={0} cy={-66} r={20} fill="#FFD7B0" />
        <Path d="M-30 -74 Q0 -82 30 -74 L24 -70 Q0 -76 -24 -70Z" fill="#D9B676" />
        <Path d="M-15 -76 C-15 -96 15 -96 15 -76Z" fill="#E8C98A" />
        <Path d="M-15 -80 L15 -80" fill="none" stroke="#8A5A2B" strokeWidth={4} />
      </G>
      {/* Face. */}
      <Circle cx={-7} cy={-64} r={3.6} fill={OUTLINE} />
      <Circle cx={7} cy={-64} r={3.6} fill={OUTLINE} />
      <Path d="M-6 -55 Q0 -50 6 -55" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={-12} cy={-57} rx={3.5} ry={2.2} fill="#FF8A8A" opacity={0.7} />
      <Ellipse cx={12} cy={-57} rx={3.5} ry={2.2} fill="#FF8A8A" opacity={0.7} />
    </G>
  );
}

export const Explorer = memo(ExplorerComponent);
