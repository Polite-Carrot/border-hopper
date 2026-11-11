import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Rect, Use } from 'react-native-svg';
import { MAP_HEIGHT, MAP_WIDTH } from '../../core/world';
import { BaseLayer } from './BaseLayer';
import { Highlights, type HighlightsProps } from './Highlights';
import type { Stage } from './camera';

/**
 * The world at rest -- every country, three copies wide -- as a layer of its
 * own, moved by the graphics chip rather than redrawn.
 *
 * Why: the camera glides on every move, and the player drags and pinches. If
 * the world sits inside the SVG group the camera moves, every frame of that
 * makes the browser re-measure and repaint 230 detailed outlines three times
 * over. Desktop Chrome copes; an iPhone's WebView does not, and the game
 * stutters. Measured in Chrome with the CPU slowed to phone speed, the world
 * was most of a glide's layout time and nearly all of its dropped frames.
 *
 * How: the world is drawn once for an *anchor* view, with 0.4 of a screen of
 * spare map on every side. While the view moves, the layer is only shifted
 * and scaled with a CSS transform -- no drawing at all. It is drawn again
 * (re-anchored) once the view settles, so it is sharp at rest, and mid-move
 * only when the view has zoomed too far from the anchor (it would go soft or
 * show its edges) or panned past the spare map.
 *
 * The highlights -- route, current, destination, hint, closed, rejected --
 * are drawn into the same layer, so they redraw with it once a move rather
 * than once a frame. The explorer and the markers, which move during play,
 * stay in the SVG on top, which is cheap to redraw.
 */

/** Spare map drawn beyond each edge of the screen, as a share of its size. */
const MARGIN = 0.4;
/** How far the view may zoom from the anchor before the world is redrawn. */
const MIN_RATIO = 0.6;
const MAX_RATIO = 1.8;
/** How long the view must be still before the world is redrawn sharp. */
const SETTLE_MS = 140;

const WORLD_ID = 'bh-base-world';
const COPIES = [-1, 0, 1] as const;

type Node = Animated.AnimatedNode | Animated.AnimatedInterpolation<number> | Animated.Value;

export interface BaseMapProps {
  stage: Stage;
  ocean: string;
  /** The camera transform: map point p lands at (x, y) + scale * p. */
  camera: { scale: Node; x: Node; y: Node };
  /** The camera's progress through its current move; a new value per move. */
  progress: Animated.Value;
  /** The player's pinch and pan, applied about the middle of the stage. */
  user?: { scale: Animated.Value; translateX: Animated.Value; translateY: Animated.Value };
  /** The route, current, destination, hinted, closed and rejected countries. */
  visited: HighlightsProps['visited'];
  destinationPath?: string;
  currentPath?: string;
  invalidPath?: string;
  hintPath?: string;
  closed?: readonly string[];
}

/** A view of the map: map point p lands on screen at t + k * p. */
interface View2D {
  k: number;
  tx: number;
  ty: number;
}

/** Animated keeps no public synchronous getter; every node has this one. */
const read = (node: Node | undefined, fallback: number): number => {
  const value = (node as unknown as { __getValue?: () => number } | undefined)?.__getValue?.();
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const BaseMap = memo(function BaseMap({
  stage, ocean, camera, progress, user, visited, destinationPath, currentPath, invalidPath, hintPath, closed,
}: BaseMapProps) {
  const layer = useRef<View | null>(null);
  const latest = useRef({ stage, camera, user });
  latest.current = { stage, camera, user };

  /**
   * Where the map is on screen right now: the camera's transform, then the
   * player's pinch and pan about the middle of the stage -- the same two
   * transforms the SVG on top applies, read from the same Animated values.
   */
  const now = useCallback((): View2D => {
    const { stage: s, camera: c, user: u } = latest.current;
    const k = read(c.scale, 1);
    const x = read(c.x, 0);
    const y = read(c.y, 0);
    const us = read(u?.scale, 1);
    const ux = read(u?.translateX, 0);
    const uy = read(u?.translateY, 0);
    const cx = s.width / 2;
    const cy = s.height / 2;
    return { k: us * k, tx: cx + ux + us * (x - cx), ty: cy + uy + us * (y - cy) };
  }, []);

  const [anchor, setAnchor] = useState<View2D>(now);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Shifts and scales the drawn world onto the current view; redraws it if it must. */
  const update = useCallback(() => {
    const node = layer.current as unknown as
      | { style?: CSSStyleDeclaration; setNativeProps?: (props: object) => void }
      | null;
    if (!node) return;
    const { stage: s } = latest.current;
    const a = anchorRef.current;
    const v = now();
    const ratio = v.k / a.k;
    let dx = v.tx - ratio * a.tx;
    const dy = v.ty - ratio * a.ty;
    // The world repeats every MAP_WIDTH, so a shift by a whole world is no
    // shift at all: take the one that keeps the drawn part on screen. (The
    // gestures fold their own offset the same way.)
    const period = v.k * MAP_WIDTH;
    if (period > 1) dx -= period * Math.round((dx - (s.width / 2) * (1 - ratio)) / period);

    // The screen, in the anchor's coordinates, must lie inside what was drawn.
    const mx = s.width * MARGIN;
    const my = s.height * MARGIN;
    const covered =
      -dx / ratio >= -mx &&
      (s.width - dx) / ratio <= s.width + mx &&
      -dy / ratio >= -my &&
      (s.height - dy) / ratio <= s.height + my;

    const transform = `translate(${dx}px, ${dy}px) scale(${ratio})`;
    if (node.style) node.style.transform = transform;
    else node.setNativeProps?.({ style: { transform: [{ translateX: dx }, { translateY: dy }, { scale: ratio }] } });

    const still = Math.abs(ratio - 1) < 1e-3 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5;
    if (settle.current) clearTimeout(settle.current);
    settle.current = null;
    if (!covered || ratio < MIN_RATIO || ratio > MAX_RATIO) {
      setAnchor(v);
    } else if (!still) {
      settle.current = setTimeout(() => {
        settle.current = null;
        setAnchor(now());
      }, SETTLE_MS);
    }
  }, [now]);

  // Follow the camera and the player's fingers. `progress` is a new value for
  // every camera move, so this re-subscribes each time.
  useEffect(() => {
    const values = [progress, user?.scale, user?.translateX, user?.translateY].filter(Boolean) as Animated.Value[];
    const ids = values.map((value) => value.addListener(update));
    return () => values.forEach((value, i) => value.removeListener(ids[i]));
  }, [progress, user, update]);

  // A new anchor, stage or camera: put the layer right before the frame paints.
  useLayoutEffect(() => {
    const node = layer.current as unknown as { style?: CSSStyleDeclaration } | null;
    if (node?.style) {
      node.style.transformOrigin = '0 0';
      node.style.willChange = 'transform';
    }
    update();
  }, [anchor, stage, camera, update]);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  const mx = stage.width * MARGIN;
  const my = stage.height * MARGIN;
  return (
    <View ref={layer} pointerEvents="none" style={[styles.layer, { width: stage.width, height: stage.height }]}>
      <DrawnWorld
        width={stage.width + mx * 2}
        height={stage.height + my * 2}
        left={-mx}
        top={-my}
        ocean={ocean}
        k={anchor.k}
        tx={anchor.tx + mx}
        ty={anchor.ty + my}
        visited={visited}
        destinationPath={destinationPath}
        currentPath={currentPath}
        invalidPath={invalidPath}
        hintPath={hintPath}
        closed={closed}
      />
    </View>
  );
});

/**
 * The world drawn for one view, highlights on top. Redrawn only when the
 * anchor moves or a highlight changes -- once a move, not once a frame.
 */
const DrawnWorld = memo(function DrawnWorld({
  width, height, left, top, ocean, k, tx, ty, visited, destinationPath, currentPath, invalidPath, hintPath, closed,
}: {
  width: number;
  height: number;
  left: number;
  top: number;
  ocean: string;
  k: number;
  tx: number;
  ty: number;
} & Omit<HighlightsProps, 'offset'>) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left, top }}>
      <Rect x={0} y={0} width={width} height={height} fill={ocean} />
      <Defs>
        <G id={WORLD_ID}>
          <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="transparent" />
          <BaseLayer />
        </G>
      </Defs>
      <G transform={`translate(${tx} ${ty}) scale(${k})`}>
        {COPIES.map((copy) => (
          <Use key={copy} href={`#${WORLD_ID}`} x={copy * MAP_WIDTH} />
        ))}
        {COPIES.map((copy) => (
          <Highlights
            key={`highlights-${copy}`}
            offset={copy * MAP_WIDTH}
            visited={visited}
            destinationPath={destinationPath}
            currentPath={currentPath}
            invalidPath={invalidPath}
            hintPath={hintPath}
            closed={closed}
          />
        ))}
      </G>
    </Svg>
  );
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, overflow: 'visible' },
});
