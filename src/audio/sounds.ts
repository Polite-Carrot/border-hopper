/**
 * Sound effects are not part of the MVP, but every place that should make a
 * noise already calls through here. Adding audio later means implementing
 * `play` once -- loading expo-av players keyed by `Sound` -- and nothing else
 * in the game has to change.
 */
export type Sound = 'tap' | 'select' | 'move' | 'invalid' | 'arrive' | 'win';

let enabled = false;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function play(_sound: Sound): void {
  if (!enabled) return;
  // No audio assets ship with the MVP.
}
