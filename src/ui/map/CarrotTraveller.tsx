import { memo } from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * Where the carrot's root tip lands once the artwork is tilted: the point it
 * stands on. Measured from the rotated paths rather than guessed, so the feet
 * sit exactly on the country's anchor instead of hovering beside it.
 */
const FOOT_X = 422.9;
const FOOT_Y = 846.7;

/** On-screen height of the traveller, in pixels. */
export const TRAVELLER_HEIGHT = 34;
const SCALE = TRAVELLER_HEIGHT / 750;

/**
 * The Polite Carrot as a traveller: the studio's mascot from the startup
 * screen, without its black tile, standing on the tip of its root.
 *
 * Drawn with its feet at (0, 0), so whoever places it only has to say where
 * the ground is, and squashing it on landing presses it into the ground rather
 * than shrinking it towards its middle.
 */
function CarrotTravellerComponent() {
  return (
    <G transform={`scale(${SCALE}) translate(${-FOOT_X} ${-FOOT_Y})`}>
      <G transform="rotate(8 512 512)">
        {/* A dark outline under everything, so it reads against any country. */}
        <Path
          d="M368 323 C418 283 565 279 637 332 C684 367 669 447 637 533 C602 626 547 735 491 841 C478 865 445 859 438 833 C406 716 371 594 345 487 C323 397 322 359 368 323Z"
          fill="none"
          stroke="#0B1A2A"
          strokeWidth={48}
          strokeLinejoin="round"
        />
        <Path d="M476 321 C417 252 417 170 467 119 C505 177 518 247 512 320Z" fill="#65B84F" stroke="#0B1A2A" strokeWidth={22} strokeLinejoin="round" />
        <Path d="M527 320 C532 229 577 157 648 138 C644 220 604 282 559 329Z" fill="#4B9D43" stroke="#0B1A2A" strokeWidth={22} strokeLinejoin="round" />
        <Path d="M458 337 C374 310 322 250 325 180 C396 207 449 260 484 326Z" fill="#7BCB59" stroke="#0B1A2A" strokeWidth={22} strokeLinejoin="round" />
        <Path
          d="M368 323 C418 283 565 279 637 332 C684 367 669 447 637 533 C602 626 547 735 491 841 C478 865 445 859 438 833 C406 716 371 594 345 487 C323 397 322 359 368 323Z"
          fill="#FF6B1A"
        />
        {/* Eyes a touch bigger than the logo's, so they still read at map size. */}
        <Ellipse cx={435} cy={448} rx={15} ry={20} fill="#111" />
        <Ellipse cx={548} cy={448} rx={15} ry={20} fill="#111" />
        <Circle cx={430} cy={441} r={5} fill="#FFF" />
        <Circle cx={543} cy={441} r={5} fill="#FFF" />
        <Path d="M458 491 C478 496 507 496 528 489" fill="none" stroke="#421A12" strokeWidth={10} strokeLinecap="round" />
        <Path
          d="M382 564 L423 576 M409 655 L448 666 M548 570 L590 553 M509 741 L539 727"
          fill="none"
          stroke="#D9470B"
          strokeWidth={13}
          strokeLinecap="round"
        />
      </G>
    </G>
  );
}

export const CarrotTraveller = memo(CarrotTravellerComponent);
