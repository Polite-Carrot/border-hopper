import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme';

export type IconName =
  | 'search' | 'close' | 'back' | 'target' | 'play' | 'calendar'
  | 'stats' | 'settings' | 'share' | 'again' | 'check' | 'chevron';

const PATHS: Record<IconName, string> = {
  search: 'M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25 1.42-1.42-4.25-4.24A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z',
  close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z',
  back: 'M14.7 5.3 8 12l6.7 6.7 1.4-1.4-5.3-5.3 5.3-5.3-1.4-1.4Z',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z',
  play: 'M8 5.1v13.8L19 12 8 5.1Z',
  calendar: 'M7 2v2H5.5A2.5 2.5 0 0 0 3 6.5v13A2.5 2.5 0 0 0 5.5 22h13a2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 18.5 4H17V2h-2v2H9V2H7Zm12 8v9.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V10h14Z',
  stats: 'M4 20V10h4v10H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-1.2-8.5-.4 2.6a8 8 0 0 0-1.6.9L6.4 4.5 3.6 9.4l2.1 1.6a8 8 0 0 0 0 1.9l-2.1 1.6 2.8 4.9 2.4-1a8 8 0 0 0 1.6.9l.4 2.6h5.6l.4-2.6a8 8 0 0 0 1.6-.9l2.4 1 2.8-4.9-2.1-1.6a8 8 0 0 0 0-1.9l2.1-1.6-2.8-4.9-2.4 1a8 8 0 0 0-1.6-.9L16.4 2h-5.6Z',
  share: 'M12 2 7 7.3l1.45 1.4L11 6.05V15h2V6.05l2.55 2.65L17 7.3 12 2ZM5 12v8.5A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V12h-2v8H7v-8H5Z',
  again: 'M12 4V1L7.5 5.5 12 10V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8Z',
  check: 'M9.6 16.2 4.8 11.4l-1.4 1.4 6.2 6.2L20.6 7 19.2 5.6 9.6 16.2Z',
  chevron: 'M9.3 6 8 7.4l4.6 4.6L8 16.6 9.3 18l6-6-6-6Z',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'target' ? <Circle cx={12} cy={12} r={3.2} fill={color} /> : null}
      <Path d={PATHS[name]} fill={color} />
    </Svg>
  );
}
