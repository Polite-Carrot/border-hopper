import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

export type LayoutMode = 'stacked' | 'sidebar';

export interface Layout {
  mode: LayoutMode;
  width: number;
  height: number;
  /** Width of the docked control panel in sidebar mode. */
  panelWidth: number;
  /** Attach to the screen's root view so the layout measures itself. */
  onLayout: (event: LayoutChangeEvent) => void;
}

/**
 * Phones in portrait get a bottom control panel under a full-width map.
 * Anything wider -- landscape phones, tablets, desktop browsers -- docks the
 * panel to the side so the map keeps the space it deserves.
 *
 * The size comes from measuring the root view rather than asking the window.
 * Neither window figure is the right one on mobile web: `useWindowDimensions`
 * reports the visual viewport, which shrinks by the on-screen keyboard, and
 * `window.innerHeight` reports a layout viewport that includes the space
 * behind the browser's own chrome. Measuring gives the box the panel is
 * actually positioned against, on every platform, and it does not move when
 * the keyboard opens.
 */
export function useLayout(): Layout {
  // Only a fallback for the first frame, before the root view has measured.
  const fallback = useWindowDimensions();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setBox((previous) =>
      previous && previous.width === width && previous.height === height ? previous : { width, height }
    );
  }, []);

  const width = box?.width ?? fallback.width;
  const height = box?.height ?? fallback.height;
  const mode: LayoutMode = width >= 720 && width > height * 1.1 ? 'sidebar' : 'stacked';
  const panelWidth = Math.min(420, Math.max(320, width * 0.3));

  return { mode, width, height, panelWidth, onLayout };
}
