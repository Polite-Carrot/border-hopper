import { Platform } from 'react-native';

/**
 * One dark palette for the whole game. Deep navy paper, dark blue ocean,
 * muted blue-grey land, and a single bright blue for "you are here".
 */
export const colors = {
  background: '#050A12',
  ocean: '#07101D',
  surface: 'rgba(13, 22, 36, 0.965)',
  surfaceSolid: '#0D1624',
  surfaceRaised: 'rgba(22, 35, 52, 0.75)',
  hairline: 'rgba(120, 160, 205, 0.12)',
  hairlineStrong: 'rgba(120, 160, 205, 0.22)',

  land: '#1E2E43',
  landTerritory: '#152236',
  landStroke: '#0A1220',
  visited: '#31567E',

  current: '#3DBDF8',
  currentDeep: '#0B4F73',
  destination: '#FF7BA8',

  text: '#E9F1FA',
  textMuted: '#8098B4',
  textFaint: 'rgba(85, 105, 130, 0.9)',
  danger: '#FF6B81',
  success: '#5CE0A8',
  gold: '#FFCE6A',
} as const;

export const mapColors = {
  ocean: '#07101D',
  land: '#1E2E43',
  territory: '#152236',
  stroke: '#080F1B',
  visited: '#31567E',
  current: '#3DBDF8',
  currentStroke: '#9FE2FF',
  destination: '#FF7BA8',
  invalid: '#FF6B81',
} as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

export const fonts = {
  /** Wide-tracked uppercase for the wordmark and section headers. */
  display: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'system-ui' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
} as const;

export const timing = {
  /** How long the camera takes to travel to a newly entered country. */
  travel: 1100,
  /** The opening shot that frames start and destination together. */
  establish: 1400,
  quick: 180,
  medium: 320,
} as const;
