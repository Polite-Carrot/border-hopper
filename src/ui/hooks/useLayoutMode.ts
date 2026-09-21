import { Platform, useWindowDimensions } from 'react-native';

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
 *
 * On the web this reports the *layout* viewport rather than what
 * `useWindowDimensions` gives, which is the visual viewport and therefore
 * shrinks by the height of the on-screen keyboard. Laying the game out against
 * that would shrink the map every time the player started typing, and the
 * panel is positioned against the layout viewport regardless.
 */
export function useLayout(): Layout {
  // Subscribed to for the re-render: the visual viewport changes whenever the
  // layout viewport does, plus on keyboard and rotation.
  const dimensions = useWindowDimensions();
  const width = Platform.OS === 'web' ? globalThis.innerWidth || dimensions.width : dimensions.width;
  const height = Platform.OS === 'web' ? globalThis.innerHeight || dimensions.height : dimensions.height;

  const mode: LayoutMode = width >= 720 && width > height * 1.1 ? 'sidebar' : 'stacked';
  const panelWidth = Math.min(420, Math.max(320, width * 0.3));
  return { mode, width, height, panelWidth };
}
