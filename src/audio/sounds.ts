import { playHop, playJingle } from './synth';

/**
 * Every place that should make a noise calls through here, so the rest of the
 * game never touches audio directly.
 *
 * Two sounds are wired: a hop for each border crossed and a jingle on arrival.
 * The other names stay silent on purpose -- a click on every button and a buzz
 * on every wrong guess are the fastest way to get the sound switched off, and
 * haptics already cover mistakes.
 */
export type Sound = 'tap' | 'select' | 'move' | 'invalid' | 'arrive' | 'win';

/**
 * Overall loudness. Measured by rendering the real synth offline: the jingle
 * peaks at -12.8 dBFS and the hop at -14.1, against the near-0 dBFS most game
 * audio is mastered to. Soft enough to sit under music or a podcast, loud
 * enough to hear at normal volume -- 0.18 measured -37 dBFS RMS, which on a
 * phone speaker is close to inaudible. One number to change if it is wrong.
 */
const VOLUME = 0.3;

let enabled = false;
let context: AudioContext | null = null;
let master: GainNode | null = null;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/**
 * The audio context, made on first use.
 *
 * Lazily, because browsers -- and the iOS WebView the app runs in -- refuse to
 * start audio until the player has touched something, and every sound here is
 * played from inside a tap or key press. Returns null wherever Web Audio does
 * not exist, which makes every sound a silent no-op rather than an error.
 */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (context && master) return { ctx: context, out: master };
  const scope = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
    navigator?: { audioSession?: { type: string } };
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    // "ambient" mixes with whatever is already playing instead of stopping it,
    // and on iPhone follows the silent switch. A casual game has no business
    // pausing somebody's music to play a jingle.
    if (scope.navigator?.audioSession) scope.navigator.audioSession.type = 'ambient';
    context = new Ctor();
    master = context.createGain();
    master.gain.value = VOLUME;
    master.connect(context.destination);
    return { ctx: context, out: master };
  } catch {
    context = null;
    master = null;
    return null;
  }
}

export function play(sound: Sound): void {
  if (!enabled) return;
  if (sound !== 'move' && sound !== 'win') return;
  const live = audio();
  if (!live) return;
  try {
    if (live.ctx.state === 'suspended') void live.ctx.resume();
    // A hair in the future, so the first note is never clipped by scheduling.
    const at = live.ctx.currentTime + 0.01;
    if (sound === 'move') playHop(live.ctx, live.out, at);
    else playJingle(live.ctx, live.out, at);
  } catch {
    // Sound is a nicety; it must never cost a move.
  }
}
