import { describe, expect, it, mock } from 'bun:test';
import type { IRenderer } from '@vectojs/core';
import { Slider } from '@vectojs/ui';
import {
  DanmakuCommandDeck,
  type DanmakuBufferedRange,
} from '../src/ui/command/DanmakuCommandDeck';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME } from '../src/ui/theme';

interface Painted {
  /** Every `roundRect` paired with the `fill` color that committed it. */
  bars: { x: number; width: number; color: string }[];
  /** Fill colors in paint order, so layering can be asserted. */
  order: string[];
}

/**
 * Renderer that records geometry and the color that filled it. Asserting what
 * reaches the renderer is what makes these tests non-tautological: reading the
 * component's own fields back would pass even if nothing were painted.
 */
function recordingRenderer(): { renderer: IRenderer; painted: Painted } {
  const painted: Painted = { bars: [], order: [] };
  let pending: { x: number; width: number } | null = null;
  const renderer = {
    beginPath() {
      pending = null;
    },
    roundRect(x: number, _y: number, width: number) {
      pending = { x, width };
    },
    arc() {
      pending = null;
    },
    fill(color: string) {
      painted.order.push(color);
      if (pending) painted.bars.push({ ...pending, color });
    },
    stroke() {},
    save() {},
    restore() {},
    clip() {},
    translate() {},
    setGlobalAlpha() {},
    fillText() {},
    measureText: () => ({ width: 0 }),
  } as unknown as IRenderer;
  return { renderer, painted };
}

function createDeck(): DanmakuCommandDeck {
  return new DanmakuCommandDeck({
    width: 760,
    labels: DEFAULT_DANMAKU_KIT_LABELS,
    theme: DEFAULT_DANMAKU_KIT_THEME,
    callbacks: {
      onSend: () => {},
      onPlayPause: () => {},
      onSeek: () => {},
      onRateChange: () => {},
      onToggleLab: () => {},
    },
  });
}

function timelineOf(deck: DanmakuCommandDeck): Slider {
  return deck.children.find((child) => child instanceof Slider) as Slider;
}

function mount(deck: DanmakuCommandDeck): {
  markDirty: ReturnType<typeof mock>;
} {
  const markDirty = mock(() => {});
  const sceneState = { forcedColors: false, markDirty };
  // Entity has no public scene setter; this emulates a mounted on-demand scene.
  (deck as unknown as { _scene: typeof sceneState })._scene = sceneState;
  const timeline = timelineOf(deck);
  (timeline as unknown as { _scene: typeof sceneState })._scene = sceneState;
  return { markDirty };
}

function setState(
  deck: DanmakuCommandDeck,
  buffered: readonly DanmakuBufferedRange[] | undefined,
  currentTime = 0,
): void {
  deck.setPlaybackState({
    currentTime,
    duration: 100,
    playing: true,
    rate: 1,
    disabled: false,
    buffered,
  });
}

/** Bars painted with the buffered token, in paint order. */
function bufferedBars(painted: Painted): { x: number; width: number }[] {
  return painted.bars
    .filter((bar) => bar.color === DEFAULT_DANMAKU_KIT_THEME.bufferedTrack)
    .map(({ x, width }) => ({ x, width }));
}

describe('scrubber buffer-ahead indication', () => {
  it('paints one bar per downloaded range, scaled to the slider width', () => {
    const deck = createDeck();
    mount(deck);
    const timeline = timelineOf(deck);
    setState(deck, [
      { start: 0, end: 25 },
      { start: 50, end: 75 },
    ]);
    const { renderer, painted } = recordingRenderer();

    timeline.render(renderer);

    const bars = bufferedBars(painted);
    expect(bars).toHaveLength(2);
    // duration 100 over the slider's width: 0..25s and 50..75s each map to a quarter.
    expect(bars[0]!.x).toBeCloseTo(0, 5);
    expect(bars[0]!.width).toBeCloseTo(timeline.width * 0.25, 5);
    expect(bars[1]!.x).toBeCloseTo(timeline.width * 0.5, 5);
    expect(bars[1]!.width).toBeCloseTo(timeline.width * 0.25, 5);
  });

  it('paints buffered above the empty track and below the progress fill', () => {
    const deck = createDeck();
    mount(deck);
    const timeline = timelineOf(deck);
    setState(deck, [{ start: 0, end: 80 }], 40);
    const { renderer, painted } = recordingRenderer();

    timeline.render(renderer);

    const track = painted.order.indexOf(DEFAULT_DANMAKU_KIT_THEME.border);
    const buffered = painted.order.indexOf(DEFAULT_DANMAKU_KIT_THEME.bufferedTrack);
    const progress = painted.order.indexOf(DEFAULT_DANMAKU_KIT_THEME.signal);
    expect(track).toBeGreaterThanOrEqual(0);
    expect(buffered).toBeGreaterThan(track);
    expect(progress).toBeGreaterThan(buffered);
  });

  it('merges overlapping ranges so a translucent fill cannot double-composite', () => {
    const deck = createDeck();
    mount(deck);
    const timeline = timelineOf(deck);
    setState(deck, [
      { start: 0, end: 40 },
      { start: 30, end: 60 },
      { start: 55, end: 70 },
    ]);
    const { renderer, painted } = recordingRenderer();

    timeline.render(renderer);

    const bars = bufferedBars(painted);
    expect(bars).toHaveLength(1);
    expect(bars[0]!.x).toBeCloseTo(0, 5);
    expect(bars[0]!.width).toBeCloseTo(timeline.width * 0.7, 5);
  });

  it('clamps to the media duration and drops empty or non-finite ranges', () => {
    const deck = createDeck();
    mount(deck);
    const timeline = timelineOf(deck);
    setState(deck, [
      { start: -20, end: 10 },
      { start: 90, end: 400 },
      { start: 50, end: 50 },
      { start: Number.NaN, end: 30 },
      { start: 20, end: Number.POSITIVE_INFINITY },
    ]);
    const { renderer, painted } = recordingRenderer();

    timeline.render(renderer);

    const bars = bufferedBars(painted);
    expect(bars).toHaveLength(2);
    // -20..10 clamps to 0..10; 90..400 clamps to 90..100. Both stay on the track.
    expect(bars[0]!.x).toBeCloseTo(0, 5);
    expect(bars[0]!.width).toBeCloseTo(timeline.width * 0.1, 5);
    expect(bars[1]!.x).toBeCloseTo(timeline.width * 0.9, 5);
    expect(bars[1]!.width).toBeCloseTo(timeline.width * 0.1, 5);
    for (const bar of bars) {
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(timeline.width + 1e-6);
    }
  });

  it('paints nothing when no buffered ranges are supplied', () => {
    const deck = createDeck();
    mount(deck);
    const timeline = timelineOf(deck);
    setState(deck, undefined);
    const { renderer, painted } = recordingRenderer();

    timeline.render(renderer);

    expect(bufferedBars(painted)).toHaveLength(0);
    // The track and progress still paint, so an absent buffer is not a blank slider.
    expect(painted.order).toContain(DEFAULT_DANMAKU_KIT_THEME.border);
    expect(painted.order).toContain(DEFAULT_DANMAKU_KIT_THEME.signal);
  });

  it('does not mark the scene dirty while the painted buffer is unchanged', () => {
    const deck = createDeck();
    const { markDirty } = mount(deck);
    setState(deck, [{ start: 0, end: 50 }]);
    const bufferedCalls = () =>
      markDirty.mock.calls.filter(
        (call) => (call[0] as { reason?: string } | undefined)?.reason === 'playback-buffered',
      ).length;
    const afterFirst = bufferedCalls();
    expect(afterFirst).toBeGreaterThan(0);

    // A poll that reports the same span, and one whose growth is sub-pixel.
    setState(deck, [{ start: 0, end: 50 }]);
    setState(deck, [{ start: 0, end: 50.001 }]);

    expect(bufferedCalls()).toBe(afterFirst);
  });

  it('marks the scene dirty when the buffer grows by a visible amount', () => {
    const deck = createDeck();
    const { markDirty } = mount(deck);
    setState(deck, [{ start: 0, end: 20 }]);
    const bufferedCalls = () =>
      markDirty.mock.calls.filter(
        (call) => (call[0] as { reason?: string } | undefined)?.reason === 'playback-buffered',
      ).length;
    const afterFirst = bufferedCalls();

    setState(deck, [{ start: 0, end: 60 }]);

    expect(bufferedCalls()).toBe(afterFirst + 1);
  });

  it('keeps buffered legible under forced colors without reusing the progress color', () => {
    const deck = createDeck();
    const markDirty = mock(() => {});
    const sceneState = { forcedColors: true, markDirty };
    (deck as unknown as { _scene: typeof sceneState })._scene = sceneState;
    const timeline = timelineOf(deck);
    (timeline as unknown as { _scene: typeof sceneState })._scene = sceneState;
    setState(deck, [{ start: 0, end: 50 }], 10);
    const { renderer, painted } = recordingRenderer();

    timeline.render(renderer);

    const buffered = painted.bars.filter((bar) => bar.color === 'GrayText');
    expect(buffered).toHaveLength(1);
    expect(buffered[0]!.width).toBeCloseTo(timeline.width * 0.5, 5);
    // System colors only, and buffered must stay distinct from progress.
    expect(painted.order).toContain('Canvas');
    expect(painted.order).toContain('Highlight');
    expect(painted.order).not.toContain(DEFAULT_DANMAKU_KIT_THEME.bufferedTrack);
  });
});
