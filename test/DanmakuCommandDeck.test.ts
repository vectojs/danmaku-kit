import { describe, expect, it, mock } from 'bun:test';
import type { IRenderer } from '@vectojs/core';
import { Button, Dropdown, Input, measureText, Slider, Text } from '@vectojs/ui';
import {
  COMMAND_DECK_CONTROL_IDS,
  DanmakuCommandDeck,
  type CommandDeckBounds,
  type CommandDeckGroupId,
  type CommandDeckLayoutSnapshot,
} from '../src/ui/command/DanmakuCommandDeck';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME, type DanmakuKitTheme } from '../src/ui/theme';

interface Calls {
  sent: string[];
  playPause: number;
  seeks: number[];
  rates: number[];
  lab: number;
}

function createDeck(width = 760, compact = false): { deck: DanmakuCommandDeck; calls: Calls } {
  const calls: Calls = { sent: [], playPause: 0, seeks: [], rates: [], lab: 0 };
  const deck = new DanmakuCommandDeck({
    width,
    compact,
    labels: DEFAULT_DANMAKU_KIT_LABELS,
    theme: DEFAULT_DANMAKU_KIT_THEME,
    callbacks: {
      onSend: (text) => calls.sent.push(text),
      onPlayPause: () => calls.playPause++,
      onSeek: (time) => calls.seeks.push(time),
      onRateChange: (rate) => calls.rates.push(rate),
      onToggleLab: () => calls.lab++,
    },
  });
  return { deck, calls };
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: typeof a,
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function expectBoundedAndNonOverlapping(deck: DanmakuCommandDeck): CommandDeckLayoutSnapshot {
  const snapshot = deck.layoutSnapshot();
  const bounds = Object.values(snapshot);
  for (const bound of bounds) {
    expect(bound.x).toBeGreaterThanOrEqual(0);
    expect(bound.y).toBeGreaterThanOrEqual(0);
    expect(bound.width).toBeGreaterThan(0);
    expect(bound.height).toBeGreaterThan(0);
    expect(bound.x + bound.width).toBeLessThanOrEqual(deck.width);
    expect(bound.y + bound.height).toBeLessThanOrEqual(deck.height);
  }
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      expect(overlaps(bounds[i]!, bounds[j]!)).toBe(false);
    }
  }
  return snapshot;
}

function controls(deck: DanmakuCommandDeck) {
  const input = deck.children.find((child) => child instanceof Input) as Input;
  const buttons = deck.children.filter((child) => child instanceof Button) as Button[];
  const timeline = deck.children.find((child) => child instanceof Slider) as Slider;
  const rate = deck.children.find((child) => child instanceof Dropdown) as Dropdown;
  const elapsed = deck.children.find((child) => child instanceof Text) as Text;
  return { input, buttons, timeline, rate, elapsed };
}

describe('DanmakuCommandDeck', () => {
  it('gives every interactive control an explicit accessible name', () => {
    const { deck } = createDeck();
    const { input, buttons, timeline, rate } = controls(deck);

    expect(input.getA11yAttributes().label).toBe(
      DEFAULT_DANMAKU_KIT_LABELS.command.inputPlaceholder,
    );
    expect(buttons.map((button) => button.getA11yAttributes().label)).toEqual([
      DEFAULT_DANMAKU_KIT_LABELS.command.send,
      DEFAULT_DANMAKU_KIT_LABELS.command.play,
      DEFAULT_DANMAKU_KIT_LABELS.command.openLab,
    ]);
    expect(timeline.getA11yAttributes().label).toBe(
      DEFAULT_DANMAKU_KIT_LABELS.command.videoPosition,
    );
    expect(rate.getA11yAttributes().label).toBe(DEFAULT_DANMAKU_KIT_LABELS.command.playbackRate);
  });

  it('dispatches one trimmed message equivalently from Enter and Send', () => {
    const { deck, calls } = createDeck();
    const { input, buttons } = controls(deck);
    const send = buttons.find(
      (button) => button.label === DEFAULT_DANMAKU_KIT_LABELS.command.send,
    )!;

    input.emit('change', { value: '  first message  ' });
    input.emit('keydown', {
      nativeEvent: { key: 'Enter', isComposing: false },
      preventDefault() {},
    });
    expect(calls.sent).toEqual(['first message']);
    expect(input.value).toBe('');

    input.emit('change', { value: '  second message  ' });
    send.emit('click', {});
    expect(calls.sent).toEqual(['first message', 'second message']);
    expect(input.value).toBe('');

    input.emit('change', { value: '   ' });
    input.emit('keydown', {
      nativeEvent: { key: 'Enter', isComposing: false },
      preventDefault() {},
    });
    expect(calls.sent).toHaveLength(2);
  });

  it('lays out one bounded, non-overlapping 56px desktop row', () => {
    const { deck } = createDeck(760);
    const snapshot = expectBoundedAndNonOverlapping(deck);

    expect(deck.height).toBe(56);
    expect(new Set(Object.values(snapshot).map((bound) => bound.y))).toEqual(new Set([8]));
  });

  it('reflows the same controls into playback-first compact rows', () => {
    const { deck } = createDeck(340);
    const before = [...deck.children];

    deck.setCompact(true);
    const snapshot = expectBoundedAndNonOverlapping(deck);
    const { elapsed } = controls(deck);

    expect(deck.height).toBe(106);
    expect(snapshot.play.y).toBe(8);
    expect(snapshot.timeline.y).toBe(8);
    expect(snapshot.rate.y).toBe(8);
    expect(snapshot.lab.y).toBe(8);
    expect(snapshot.input.y).toBe(57);
    expect(snapshot.send.y).toBe(57);
    expect(snapshot.rate.width).toBeGreaterThanOrEqual(64);
    expect(elapsed.a11yHidden).toBe(true);
    expect(deck.children).toEqual(before);

    // Elapsed appears only once the measured label still leaves the scrubber
    // a usable minimum; 380 stays under that bar, 480 clears it with room for
    // both real-canvas metrics and the DOM-free width estimate bun tests use.
    deck.setWidth(380);
    expect(controls(deck).elapsed.a11yHidden).toBe(true);

    deck.setWidth(480);
    expectBoundedAndNonOverlapping(deck);
    const wideControls = controls(deck);
    const paintedWide = measureText(wideControls.elapsed.text, DEFAULT_DANMAKU_KIT_THEME.fontMono);
    expect(wideControls.rate.x).toBeGreaterThanOrEqual(wideControls.elapsed.x + paintedWide);
  });

  it('updates playback state in place and disables every playback action', () => {
    const { deck, calls } = createDeck();
    const before = [...deck.children];
    const { buttons, timeline, rate } = controls(deck);
    const play = buttons.find(
      (button) => button.label === DEFAULT_DANMAKU_KIT_LABELS.command.play,
    )!;

    deck.setPlaybackState({
      currentTime: 30,
      duration: 120,
      playing: true,
      rate: 1.5,
      disabled: false,
    });
    expect(play.label).toBe(DEFAULT_DANMAKU_KIT_LABELS.command.pause);
    expect(timeline.value).toBe(30);
    expect(timeline.max).toBe(120);
    expect(rate.getValue()).toBe('1.5×');
    expect(deck.children).toEqual(before);

    play.emit('click', {});
    timeline.emit('change', { value: 42 });
    rate.emit('change', { value: '2×' });
    expect(calls.playPause).toBe(1);
    expect(calls.seeks).toEqual([42]);
    expect(calls.rates).toEqual([2]);

    deck.setPlaybackState({
      currentTime: 0,
      duration: 0,
      playing: false,
      rate: 1,
      disabled: true,
    });
    expect(play.disabled).toBe(true);
    expect(timeline.getA11yAttributes().disabled).toBe(true);
    expect(rate.getA11yAttributes().disabled).toBe(true);

    play.emit('click', {});
    timeline.emit('change', { value: 1 });
    rate.emit('change', { value: '0.5×' });
    expect(calls.playPause).toBe(1);
    expect(calls.seeks).toEqual([42]);
    expect(calls.rates).toEqual([2]);
  });

  it('reserves at least the painted elapsed width ahead of the rate dropdown', () => {
    const { deck } = createDeck(900);
    const { rate, elapsed } = controls(deck);

    const painted = measureText(elapsed.text, DEFAULT_DANMAKU_KIT_THEME.fontMono);
    expect(elapsed.width).toBeGreaterThanOrEqual(Math.ceil(painted));
    expect(rate.x).toBeGreaterThanOrEqual(elapsed.x + painted);
  });

  it('re-measures the elapsed label when durations grow and keeps every rate option clear', () => {
    const { deck } = createDeck(900);
    const { rate, elapsed } = controls(deck);
    const rateLabels: Record<number, string> = {
      0.5: '0.5×',
      1: '1×',
      1.5: '1.5×',
      2: '2×',
    };

    // '12:34 / 84:00' paints far wider than the legacy fixed reserves; each
    // rate option must sit clear of the painted glyphs in every state.
    for (const [rateOption, label] of Object.entries(rateLabels)) {
      deck.setPlaybackState({
        currentTime: 754,
        duration: 5040,
        playing: true,
        rate: Number(rateOption),
        disabled: false,
      });
      const painted = measureText(elapsed.text, DEFAULT_DANMAKU_KIT_THEME.fontMono);
      expect(elapsed.text).toBe('12:34 / 84:00');
      expect(rate.getValue()).toBe(label);
      expect(elapsed.width).toBeGreaterThanOrEqual(Math.ceil(painted));
      expect(rate.x).toBeGreaterThanOrEqual(elapsed.x + painted);
    }
  });

  it('repaints elapsed text with a system color when forced colors changes', () => {
    const { deck } = createDeck();
    const { elapsed } = controls(deck);
    const sceneState = {
      forcedColors: true,
      markDirty() {},
    };
    // Entity has no public scene setter; this emulates a mounted forced-colors scene.
    const mountedDeck = deck as unknown as { _scene: typeof sceneState };
    mountedDeck._scene = sceneState;
    const renderer = {
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
    } as unknown as IRenderer;

    deck.render(renderer);
    expect(elapsed.color).toBe('CanvasText');

    sceneState.forcedColors = false;
    deck.render(renderer);
    expect(elapsed.color).toBe(DEFAULT_DANMAKU_KIT_THEME.textMuted);
  });

  it('marks an on-demand scene dirty after toggling the Lab label', () => {
    const { deck, calls } = createDeck();
    const markDirty = mock((_change?: { entity: string; reason: string }) => {});
    const sceneState = { forcedColors: false, markDirty };
    // Entity has no public scene setter; this emulates a mounted on-demand scene.
    const mountedDeck = deck as unknown as { _scene: typeof sceneState };
    mountedDeck._scene = sceneState;
    const lab = controls(deck).buttons.find(
      (button) => button.label === DEFAULT_DANMAKU_KIT_LABELS.command.openLab,
    )!;

    lab.emit('click', {});

    expect(lab.label).toBe(DEFAULT_DANMAKU_KIT_LABELS.command.closeLab);
    expect(calls.lab).toBe(1);
    expect(markDirty).toHaveBeenCalledWith({
      entity: deck.id,
      reason: 'lab-toggled',
    });
  });
});
type DeckOptions = ConstructorParameters<typeof DanmakuCommandDeck>[0];

/** Records every renderer call so tests can assert paint order and arguments. */
function recordingRenderer(): {
  calls: Array<{ op: string; args: unknown[] }>;
  renderer: Parameters<DanmakuCommandDeck['render']>[0];
} {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const renderer = new Proxy(
    {},
    {
      get:
        (_target, op) =>
        (...args: unknown[]) => {
          calls.push({ op: String(op), args });
        },
    },
  ) as Parameters<DanmakuCommandDeck['render']>[0];
  return { calls, renderer };
}

function createDeckWith(overrides: Partial<DeckOptions>, width = 900): DanmakuCommandDeck {
  return new DanmakuCommandDeck({
    width,
    labels: DEFAULT_DANMAKU_KIT_LABELS,
    theme: DEFAULT_DANMAKU_KIT_THEME,
    callbacks: {
      onSend: () => undefined,
      onPlayPause: () => undefined,
      onSeek: () => undefined,
      onRateChange: () => undefined,
      onToggleLab: () => undefined,
    },
    ...overrides,
  } as DeckOptions);
}

/** Compose / transport / utility, the clustering bakudan's review asked for. */
const CLUSTERS: CommandDeckGroupId[][] = [
  ['input', 'send'],
  ['play', 'timeline', 'elapsed'],
  ['rate', 'lab'],
];

describe('DanmakuCommandDeck grouping (#15)', () => {
  it('renders byte-identical geometry without groups or under an identity partition', () => {
    const plain = createDeck(760).deck;
    const identity = createDeckWith(
      {
        groups: COMMAND_DECK_CONTROL_IDS.map((id) => [id]),
      },
      760,
    );

    expect(identity.layoutSnapshot()).toEqual(plain.layoutSnapshot());
    expect(identity.height).toBe(plain.height);
  });

  it('widens only the declared cluster boundaries on the desktop row', () => {
    const deck = createDeckWith({ groups: CLUSTERS, groupGap: 24 });
    const snapshot = expectBoundedAndNonOverlapping(deck);
    const { elapsed } = controls(deck);
    const gapAfter = (left: CommandDeckBounds, rightX: number) => rightX - (left.x + left.width);

    expect(gapAfter(snapshot.input, snapshot.send.x)).toBe(8);
    expect(gapAfter(snapshot.send, snapshot.play.x)).toBe(24);
    expect(gapAfter(snapshot.play, snapshot.timeline.x)).toBe(8);
    expect(gapAfter(snapshot.timeline, elapsed.x)).toBe(8);
    expect(snapshot.rate.x).toBeGreaterThanOrEqual(elapsed.x + elapsed.width + 24);
    expect(gapAfter(snapshot.rate, snapshot.lab.x)).toBe(8);
    expect(new Set(Object.values(snapshot).map((bound) => bound.y))).toEqual(new Set([8]));
    expect(elapsed.y).toBe(snapshot.play.y + 10);
  });

  it('rejects invalid group partitions at construction', () => {
    expect(() => createDeckWith({ groups: [] })).toThrow();
    expect(() => createDeckWith({ groups: [['input'], ['input']] })).toThrow();
    expect(() =>
      createDeckWith({
        groups: [
          ['input', 'send'],
          ['play', 'timeline', 'rate', 'lab'],
        ],
      }),
    ).toThrow(); // omits elapsed
    expect(() =>
      createDeckWith({
        groups: [['input', 'send'], ['play', 'timeline', 'elapsed'], [], ['rate', 'lab']],
      }),
    ).toThrow(); // empty cluster
    expect(() =>
      createDeckWith({
        groups: [
          ['scrubber' as CommandDeckGroupId, 'send'],
          ['play', 'timeline', 'elapsed', 'rate', 'lab', 'input'],
        ],
      }),
    ).toThrow(); // unknown id
  });

  it('keeps the compact two-row shape even when grouped', () => {
    const plain = createDeck(340).deck;
    const grouped = createDeckWith({ groups: CLUSTERS, groupGap: 32 }, 340);

    plain.setCompact(true);
    grouped.setCompact(true);

    expect(grouped.layoutSnapshot()).toEqual(plain.layoutSnapshot());
    expect(grouped.height).toBe(106);
  });

  it('clamps groupGap to at least the intra-cluster gap', () => {
    const deck = createDeckWith({ groups: CLUSTERS, groupGap: 2 });
    const snapshot = deck.layoutSnapshot();

    expect(snapshot.play.x - (snapshot.send.x + snapshot.send.width)).toBe(8);
  });

  it('keeps cluster rhythm when a growing duration relayouts the row', () => {
    const deck = createDeckWith({ groups: CLUSTERS, groupGap: 24 });
    const before = deck.layoutSnapshot();

    deck.setPlaybackState({
      currentTime: 754,
      duration: 5040,
      playing: true,
      rate: 1,
      disabled: false,
    });
    const after = deck.layoutSnapshot();
    const { elapsed } = controls(deck);

    // The wider "12:34 / 1:24:00" label grows the elapsed reserve, and the
    // flexible input absorbs it: everything right of the transport cluster
    // keeps its position, so the cluster boundaries stay exactly 24px.
    expect(after.input.width).toBeLessThan(before.input.width);
    expect(after.rate.x).toBeGreaterThanOrEqual(elapsed.x + elapsed.width + 24);
    expect(after.rate.x).toBe(before.rate.x);
    expect(after.lab.x).toBe(before.lab.x);
    expectBoundedAndNonOverlapping(deck);
  });
});

describe('DanmakuCommandDeck controlHeight token (#16b)', () => {
  const TALL_THEME: DanmakuKitTheme = {
    ...DEFAULT_DANMAKU_KIT_THEME,
    controlHeight: 36,
  };

  function createThemedDeck(theme: DanmakuKitTheme): DanmakuCommandDeck {
    return createDeckWith({ theme }, 760);
  }

  it('derives every dependent container literal from the token', () => {
    const deck = createThemedDeck(TALL_THEME);

    expect(deck.height).toBe(52); // row 36 + padding 2x8, was 56 at the default
    const snapshot = deck.layoutSnapshot();
    for (const bound of Object.values(snapshot)) expect(bound.height).toBe(36);
    const { elapsed } = controls(deck);
    expect(elapsed.height).toBe(36);
    expect(elapsed.y).toBe(snapshot.play.y + 9); // proportional label centering

    deck.setCompact(true);
    expect(deck.height).toBe(98); // commentY 53 (= 8+36+9) + row 36 + gap 9, was 106
    expect(deck.layoutSnapshot().input.y).toBe(53);
  });

  it('clamps sub-floor values to the readable minimum', () => {
    const deck = createThemedDeck({
      ...DEFAULT_DANMAKU_KIT_THEME,
      controlHeight: 4,
    });

    expect(deck.height).toBe(40); // floor 24 + padding 16
    expect(Object.values(deck.layoutSnapshot())[0]!.height).toBe(24);
  });

  it('falls back to the historical default for absent or non-finite tokens', () => {
    expect(createThemedDeck(DEFAULT_DANMAKU_KIT_THEME).height).toBe(56);
    expect(
      createThemedDeck({
        ...DEFAULT_DANMAKU_KIT_THEME,
        controlHeight: Number.NaN,
      }).height,
    ).toBe(56);
  });
});

describe('surface token reachability (#16c)', () => {
  it('paints the deck plate straight from theme.surface', () => {
    const sentinel = 'rgba(9, 11, 17, 0.62)';
    const deck = createDeckWith({
      theme: { ...DEFAULT_DANMAKU_KIT_THEME, surface: sentinel },
    });
    const { calls, renderer } = recordingRenderer();

    deck.render(renderer);

    const fills = calls.filter((call) => call.op === 'fill');
    expect(fills.length).toBeGreaterThan(0);
    expect(fills[0]!.args[0]).toBe(sentinel);
  });
});
