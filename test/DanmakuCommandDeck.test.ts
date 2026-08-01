import { describe, expect, it } from 'bun:test';
import { Button, Dropdown, Input, Slider, Text } from '@vectojs/ui';
import {
  DanmakuCommandDeck,
  type CommandDeckLayoutSnapshot,
} from '../src/ui/command/DanmakuCommandDeck';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME } from '../src/ui/theme';

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

    deck.setWidth(360);
    expect(controls(deck).elapsed.a11yHidden).toBe(false);
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

    deck.setPlaybackState({ currentTime: 0, duration: 0, playing: false, rate: 1, disabled: true });
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
});
