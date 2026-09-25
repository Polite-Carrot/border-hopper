import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export interface MarkProps {
  size: number;
}

/**
 * The Polite Carrot logo.
 *
 * Transcribed path for path from `polite-carrot-logo.svg` in the Tide Runner
 * repository, so every game in the studio boots with the same mark. It carries
 * its own black rounded-square tile, which is what the app icon uses too.
 */
function PoliteCarrotMarkComponent({ size }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Rect width={1024} height={1024} rx={192} fill="#000" />
      <G transform="rotate(8 512 512)">
        {/* Leaves, left to right. */}
        <Path d="M476 321 C417 252 417 170 467 119 C505 177 518 247 512 320Z" fill="#65B84F" />
        <Path d="M527 320 C532 229 577 157 648 138 C644 220 604 282 559 329Z" fill="#4B9D43" />
        <Path d="M458 337 C374 310 322 250 325 180 C396 207 449 260 484 326Z" fill="#7BCB59" />
        {/* The carrot itself. */}
        <Path
          d="M368 323 C418 283 565 279 637 332 C684 367 669 447 637 533 C602 626 547 735 491 841 C478 865 445 859 438 833 C406 716 371 594 345 487 C323 397 322 359 368 323Z"
          fill="#FF6B1A"
        />
        <Ellipse cx={435} cy={448} rx={13} ry={17} fill="#111" />
        <Ellipse cx={548} cy={448} rx={13} ry={17} fill="#111" />
        <Circle cx={430} cy={442} r={4} fill="#FFF" />
        <Circle cx={543} cy={442} r={4} fill="#FFF" />
        <Path
          d="M458 491 C478 496 507 496 528 489"
          fill="none"
          stroke="#421A12"
          strokeWidth={9}
          strokeLinecap="round"
        />
        <Path
          d="M382 564 L423 576 M409 655 L448 666 M548 570 L590 553 M509 741 L539 727"
          fill="none"
          stroke="#D9470B"
          strokeWidth={13}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

export const PoliteCarrotMark = memo(PoliteCarrotMarkComponent);
