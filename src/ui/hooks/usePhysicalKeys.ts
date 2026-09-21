import { useEffect } from 'react';
import { Platform } from 'react-native';

export interface PhysicalKeyHandlers {
  onKey: (character: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  onEscape: () => void;
}

/**
 * Hardware keyboard support on the web, since the game no longer uses a
 * TextInput. Desktop players just type; nothing on screen has to change.
 */
export function usePhysicalKeys(enabled: boolean, handlers: PhysicalKeyHandlers): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Backspace') {
        event.preventDefault();
        handlers.onBackspace();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        handlers.onSubmit();
      } else if (event.key === 'Escape') {
        handlers.onEscape();
      } else if (/^[a-zA-Z ]$/.test(event.key)) {
        event.preventDefault();
        handlers.onKey(event.key.toLowerCase());
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [enabled, handlers]);
}
