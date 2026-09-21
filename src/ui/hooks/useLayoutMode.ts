import { useWindowDimensions } from 'react-native';

export type LayoutMode = 'stacked' | 'sidebar';

export interface Layout {
  mode: LayoutMode;
  width: number;
  height: number;
  /** Width of the docked control panel in sidebar mode. */
  panelWidth: number;
}

/**
 * Phones in portrait get a bottom control panel under a full-width map.
 * Anything wider -- landscape phones, tablets, desktop browsers -- docks the
 * panel to the side so the map keeps the space it deserves.
 */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const mode: LayoutMode = width >= 720 && width > height * 1.1 ? 'sidebar' : 'stacked';
  const panelWidth = Math.min(420, Math.max(320, width * 0.3));
  return { mode, width, height, panelWidth };
}
