import { memo } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { TRAVELLER_HEIGHT } from './Explorer';

/** Drawn 96 units tall, like the explorer, and shown at the same size. */
const SCALE = TRAVELLER_HEIGHT / 96;
const OUTLINE = '#0B1A2A';
const UNIFORM = '#24457E';
const TUNIC = 'M-16 -44 C-16 -52 16 -52 16 -44 L18 -18 C18 -12 -18 -12 -18 -18Z';

export interface PoliceOfficerProps {
  /** 1 to face east, -1 to face west: towards the explorer he is turning away. */
  facing?: 1 | -1;
  /** Skin tone, so a pair of officers are two people rather than one twice. */
  skinTone?: string;
}

/**
 * A border officer for Visa Denied: peaked cap, navy uniform, one hand up in
 * a firm "stop". Drawn like the explorer, feet at (0, 0) and outlined, so the
 * two read as one cast. Facing east; mirrored to face west.
 */
function PoliceOfficerComponent({ facing = 1, skinTone = '#F1C59B' }: PoliceOfficerProps) {
  return (
    <G scale={SCALE}>
      <G scaleX={facing}>
        <G stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
          {/* Legs and boots. */}
          <Path d="M-7 -14 L-8 -4 M7 -14 L8 -4" fill="none" strokeWidth={7} />
          <Ellipse cx={-10} cy={-3} rx={8} ry={5} fill="#15151C" />
          <Ellipse cx={10} cy={-3} rx={8} ry={5} fill="#15151C" />
          {/* The arm out front, palm up: stop. Behind the tunic at the shoulder. */}
          <Path d="M10 -42 L34 -50" fill="none" strokeWidth={14} />
          <Path d="M10 -42 L34 -50" fill="none" stroke={UNIFORM} strokeWidth={8} />
          <Circle cx={37} cy={-52} r={7} fill="#FFFFFF" />
          <Path d={TUNIC} fill={UNIFORM} />
          {/* Belt, and a badge on the chest. */}
          <Path d="M-17 -24 L17 -24" fill="none" strokeWidth={4} />
          <Circle cx={-7} cy={-38} r={4} fill="#FFCE6A" strokeWidth={3} />
          {/* Head, then the peaked cap: crown, band and brim. */}
          <Circle cx={0} cy={-66} r={20} fill={skinTone} />
          <Rect x={-19} y={-94} width={38} height={18} rx={6} fill={UNIFORM} />
          <Path d="M-20 -77 L20 -77" fill="none" stroke="#0E1B33" strokeWidth={6} />
          <Path d="M-6 -77 Q16 -78 26 -71" fill="none" stroke="#0E1B33" strokeWidth={6} />
        </G>
        {/* Cap badge. */}
        <Circle cx={0} cy={-86} r={4.5} fill="#FFCE6A" stroke={OUTLINE} strokeWidth={2} />
        {/* A stern face: eyes, brows down to the middle, a flat mouth. */}
        <Circle cx={-6} cy={-63} r={3.4} fill={OUTLINE} />
        <Circle cx={8} cy={-63} r={3.4} fill={OUTLINE} />
        <Path d="M-12 -71 L-2 -68 M14 -71 L4 -68" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
        <Path d="M-4 -54 L8 -54" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
      </G>
    </G>
  );
}

export const PoliceOfficer = memo(PoliceOfficerComponent);
