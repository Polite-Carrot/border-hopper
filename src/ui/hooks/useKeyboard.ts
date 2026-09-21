import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How much of the screen the on-screen keyboard is covering, or 0 when there
 * is no keyboard up.
 *
 * On iOS and Android this comes from the keyboard events. On the web there is
 * no such event, but mobile browsers shrink the *visual* viewport when the
 * keyboard opens while leaving the layout viewport alone, and the difference
 * between the two is the keyboard. Without this the browser is left to shove
 * the whole page around instead, which is what makes the layout lurch.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = globalThis.visualViewport;
      if (!viewport) return;
      const update = () => {
        const covered = globalThis.innerHeight - viewport.height - viewport.offsetTop;
        // Ignore the couple of pixels browser chrome moves by on its own.
        setHeight(covered > 80 ? Math.round(covered) : 0);
      };
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
      update();
      return () => {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
      };
    }

    // `will` fires at the start of the iOS animation, so the panel travels
    // with the keyboard rather than after it. Android only has `did`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
