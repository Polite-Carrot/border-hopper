/**
 * The game's sounds, synthesised rather than recorded.
 *
 * The studio's other games generate their audio with Web Audio and ship no
 * sound files, and this follows suit: two small functions instead of assets to
 * load, and every note written down where it can be read and changed.
 *
 * Each function schedules its notes onto any BaseAudioContext, starting at
 * `at`. That is what lets the same code play live in the game and render
 * offline to a file you can listen to without playing a round.
 *
 * Levels here are relative: the caller's master gain decides how loud the game
 * is overall, and keeps it quiet.
 */

type Context = BaseAudioContext;

/** Equal-tempered frequency for a note name like "C5" or "F#3". */
export function frequency(note: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!match) throw new Error(`Not a note: ${note}`);
  const semitones: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const fromA4 = semitones[match[1]] + accidental + (Number(match[3]) - 4) * 12;
  return 440 * 2 ** (fromA4 / 12);
}

/**
 * One soft, bell-like note: a sine with a quieter triangle an octave up for a
 * little sparkle, a near-instant attack and an exponential fade. It has no
 * sustain on purpose, so notes ring into each other the way a struck bell
 * does rather than stopping dead.
 */
function bell(ctx: Context, out: AudioNode, note: string, at: number, length: number, level: number) {
  const hz = frequency(note);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  env.connect(out);

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(hz, at);
  body.connect(env);

  const shimmer = ctx.createOscillator();
  const shimmerLevel = ctx.createGain();
  shimmer.type = 'triangle';
  shimmer.frequency.setValueAtTime(hz * 2, at);
  shimmerLevel.gain.value = 0.18;
  shimmer.connect(shimmerLevel).connect(env);

  for (const osc of [body, shimmer]) {
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

/** A round, quiet bass note to put a chord under the melody. */
function bass(ctx: Context, out: AudioNode, note: string, at: number, length: number, level: number) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  env.connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency(note), at);
  osc.connect(env);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/**
 * Crossing a border: a quick upward "hop".
 *
 * A single soft note that bends up a fourth as it sounds, so it moves the way
 * the camera does, and lasts under a fifth of a second so a run of fast moves
 * never piles up into noise. Its rising leap is the same interval the jingle
 * opens with, which is what makes the two sound like one game.
 */
export function playHop(ctx: Context, out: AudioNode, at: number): number {
  const length = 0.17;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.55, at + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  env.connect(out);

  const from = frequency('G4');
  const to = frequency('C5');

  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(from, at);
  tone.frequency.exponentialRampToValueAtTime(to, at + 0.07);
  tone.connect(env);

  const air = ctx.createOscillator();
  const airLevel = ctx.createGain();
  air.type = 'sine';
  air.frequency.setValueAtTime(from * 2, at);
  air.frequency.exponentialRampToValueAtTime(to * 2, at + 0.07);
  airLevel.gain.value = 0.25;
  air.connect(airLevel).connect(env);

  for (const osc of [tone, air]) {
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
  return length;
}

/**
 * Arriving: the Border Hopper jingle.
 *
 * Four quick notes hop up a C major arpeggio -- country, country, country,
 * country -- then a little lift through F and A, and a landing on high C that
 * rings out. Underneath, the bass walks I-IV-V-I, the most "you have arrived"
 * progression there is. About two seconds, finishing as the result card
 * appears, and bright without being a fanfare.
 *
 * Returns how long it lasts, ring included.
 */
export function playJingle(ctx: Context, out: AudioNode, at: number): number {
  const beat = 0.105;
  const melody: [note: string, start: number, ring: number][] = [
    ['G4', 0, 0.3],
    ['C5', 1, 0.3],
    ['E5', 2, 0.3],
    ['G5', 3, 0.45],
    ['E5', 4.6, 0.3],
    ['F5', 5.6, 0.3],
    ['A5', 6.6, 0.4],
    ['G5', 8, 0.35],
    ['C6', 9, 1.25],
  ];
  for (const [note, start, ring] of melody) bell(ctx, out, note, at + start * beat, ring, 0.32);

  // The landing gets a full chord, softer than the tune so the tune leads.
  const land = at + 9 * beat;
  bell(ctx, out, 'E5', land, 1.1, 0.12);
  bell(ctx, out, 'G4', land, 1.1, 0.1);

  const walk: [note: string, start: number, length: number][] = [
    ['C3', 0, 0.42],
    ['F3', 4.6, 0.36],
    ['G3', 8, 0.2],
    ['C3', 9, 1.2],
  ];
  for (const [note, start, length] of walk) bass(ctx, out, note, at + start * beat, length, 0.24);

  return 9 * beat + 1.25;
}
