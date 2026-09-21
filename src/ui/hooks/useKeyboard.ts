import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { loadKeyboardHeights, saveKeyboardHeights, type KeyboardHeights } from '../../storage/storage';

export type Orientation = 'portrait' | 'landscape';

export interface KeyboardMetrics {
  /** What the keyboard is covering right now. 0 when it is closed. */
  height: number;
  /**
   * What the keyboard is *expected* to cover. The panel reserves this much
   * room for the country list, so the search field already sits on the
   * keyboard's top edge before one opens and does not move when it does.
   */
  reserved: number;
}

/**
 * Heights measured this session, so the very first keyboard of a session is
 * the only one that can be off, and only until it has been seen once.
 */
const observed: KeyboardHeights = {};
let restored = false;

/** A reasonable guess until a real keyboard has been measured on this device. */
function estimate(screenHeight: number, orientation: Orientation): number {
  const fraction = orientation === 'portrait' ? 0.36 : 0.52;
  const [min, max] = orientation === 'portrait' ? [240, 360] : [170, 260];
  return Math.round(Math.min(max, Math.max(min, screenHeight * fraction)));
}

export function useKeyboardMetrics(screenHeight: number, orientation: Orientation): KeyboardMetrics {
  const [height, setHeight] = useState(0);
  const [remembered, setRemembered] = useState<KeyboardHeights>(observed);

  useEffect(() => {
    if (restored) return;
    restored = true;
    void loadKeyboardHeights().then((saved) => {
      Object.assign(observed, saved, observed);
      setRemembered({ ...observed });
    });
  }, []);

  useEffect(() => {
    const record = (next: number) => {
      setHeight(next);
      if (next <= 0 || observed[orientation] === next) return;
      observed[orientation] = next;
      setRemembered({ ...observed });
      void saveKeyboardHeights({ ...observed });
    };

    if (Platform.OS === 'web') {
      const viewport = globalThis.visualViewport;
      if (!viewport) return;
      const update = () => {
        const covered = globalThis.innerHeight - viewport.height - viewport.offsetTop;
        // Ignore the few pixels browser chrome moves by on its own.
        record(covered > 80 ? Math.round(covered) : 0);
      };
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
      update();
      return () => {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
      };
    }

    // `will` fires at the start of the iOS animation; Android only has `did`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => record(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [orientation]);

  return {
    height,
    reserved: remembered[orientation] ?? estimate(screenHeight, orientation),
  };
}
