import { describe, expect, it } from 'bun:test';
import type { IRenderer } from '@vectojs/core';
import { measureText } from '@vectojs/ui';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME, type DanmakuKitTheme } from '../src/ui/theme';
import { DanmakuStatusBar } from '../src/ui/status/DanmakuStatusBar';

const product = 'Example Player';

function createBar(width = 760): DanmakuStatusBar {
  return new DanmakuStatusBar({
    width,
    product,
    labels: DEFAULT_DANMAKU_KIT_LABELS,
    theme: DEFAULT_DANMAKU_KIT_THEME,
  });
}

describe('DanmakuStatusBar', () => {
  it('projects one complete polite status region while retaining primitive state', () => {
    const bar = createBar();

    bar.setStatus({
      state: 'stress',
      fps: 119.6,
      active: 4_980,
      capacity: 20_000,
      backend: 'WebGL/MSDF',
    });

    expect(bar.children).toHaveLength(0);
    expect(bar.getStatus()).toEqual({
      state: 'stress',
      fps: 119.6,
      active: 4_980,
      capacity: 20_000,
      backend: 'WebGL/MSDF',
    });
    expect(bar.getA11yAttributes()).toEqual({
      role: 'status',
      label: 'Example Player. Stress. 4,980 of 20,000. 119.6 frames per second. WebGL/MSDF.',
      live: 'polite',
      atomic: true,
      relevant: 'text',
      pointerEvents: 'none',
    });
  });

  it('switches compact geometry without adding status children', () => {
    const bar = createBar(340);
    expect(bar.height).toBe(34);

    bar.setCompact(true);
    expect(bar.width).toBe(340);
    expect(bar.height).toBe(44);
    expect(bar.children).toHaveLength(0);

    bar.setCompact(false);
    expect(bar.height).toBe(34);
  });

  it('keeps its devtools descriptor bounded and never enumerates slots', () => {
    const bar = createBar();
    bar.setStatus({
      state: 'video',
      fps: 60,
      active: 12_000,
      capacity: 20_000,
      backend: 'Canvas2D',
    });

    const descriptor = bar.getDevtoolsDescriptor();
    const fieldCount = descriptor.groups.reduce((count, group) => count + group.fields.length, 0);

    expect(descriptor.kind).toBe('DanmakuStatusBar');
    expect(descriptor.groups.length).toBeLessThanOrEqual(3);
    expect(fieldCount).toBeLessThanOrEqual(8);
    expect(JSON.stringify(descriptor).toLowerCase()).not.toContain('slot');
  });

  it('uses only system colors for its own forced-colors rendering', () => {
    const colors: string[] = [];
    const renderer = {
      beginPath() {},
      roundRect() {},
      fill(color: string) {
        colors.push(color);
      },
      stroke(color: string) {
        colors.push(color);
      },
      fillText(_text: string, _x: number, _y: number, _font: string, color: string) {
        colors.push(color);
      },
    } as unknown as IRenderer;
    const bar = createBar();
    (bar as unknown as { _scene: { forcedColors: boolean } })._scene = {
      forcedColors: true,
    };

    bar.render(renderer);

    expect(colors.length).toBeGreaterThan(0);
    expect(new Set(colors)).toEqual(new Set(['Canvas', 'CanvasText', 'Highlight']));
  });
});

function createBarWith(theme: DanmakuKitTheme, width = 760): DanmakuStatusBar {
  return new DanmakuStatusBar({
    width,
    product,
    labels: DEFAULT_DANMAKU_KIT_LABELS,
    theme,
  });
}

function recordingRenderer(): {
  calls: Array<{ op: string; args: unknown[] }>;
  renderer: IRenderer;
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
  ) as unknown as IRenderer;
  return { calls, renderer };
}

function stressBar(bar: DanmakuStatusBar): void {
  bar.setStatus({
    state: 'stress',
    fps: 60,
    active: 1_000,
    capacity: 20_000,
    backend: 'Canvas2D',
  });
}

describe('DanmakuStatusBar state-pill styles (#16a)', () => {
  it('strokes the pill with the state color while statusDot is unset', () => {
    const bar = createBar(760);
    stressBar(bar);
    const { calls, renderer } = recordingRenderer();

    bar.render(renderer);

    expect(calls.some((call) => call.op === 'arc')).toBe(false);
    const strokes = calls.filter((call) => call.op === 'stroke').map((call) => call.args[0]);
    expect(strokes).toContain(DEFAULT_DANMAKU_KIT_THEME.warning);
  });

  it('concentrates the state color into a neutral-outlined dot when statusDot is set', () => {
    const bar = createBarWith({
      ...DEFAULT_DANMAKU_KIT_THEME,
      statusDot: true,
    });
    stressBar(bar);
    const { calls, renderer } = recordingRenderer();

    bar.render(renderer);

    const arcs = calls.filter((call) => call.op === 'arc');
    expect(arcs).toHaveLength(1);
    expect(arcs[0]!.args[1]).toBe(17); // mid-height of the 20px desktop pill
    expect(arcs[0]!.args[2]).toBe(3);

    const fills = calls.filter((call) => call.op === 'fill').map((call) => call.args[0]);
    expect(fills.filter((color) => color === DEFAULT_DANMAKU_KIT_THEME.warning)).toHaveLength(1);
    const strokes = calls.filter((call) => call.op === 'stroke').map((call) => call.args[0]);
    expect(strokes).not.toContain(DEFAULT_DANMAKU_KIT_THEME.warning);
    expect(strokes).toContain(DEFAULT_DANMAKU_KIT_THEME.border);

    const pillRect = calls.find((call) => call.op === 'roundRect' && call.args[3] === 20)!;
    const pillWidth = pillRect.args[2] as number;
    expect(pillWidth).toBe(
      Math.ceil(
        measureText(DEFAULT_DANMAKU_KIT_LABELS.status.stress, DEFAULT_DANMAKU_KIT_THEME.fontLabel),
      ) +
        16 +
        10,
    );
    const label = calls.find(
      (call) => call.op === 'fillText' && call.args[0] === DEFAULT_DANMAKU_KIT_LABELS.status.stress,
    )!;
    expect(label.args[1]).toBe((pillRect.args[0] as number) + 17);
  });

  it('paints the dot inside the compact pill too', () => {
    const bar = createBarWith({ ...DEFAULT_DANMAKU_KIT_THEME, statusDot: true }, 340);
    bar.setCompact(true);
    stressBar(bar);
    const { calls, renderer } = recordingRenderer();

    bar.render(renderer);

    const arcs = calls.filter((call) => call.op === 'arc');
    expect(arcs).toHaveLength(1);
    expect(arcs[0]!.args[1]).toBe(14); // mid-height of the 18px compact pill
  });

  it('keeps forced-colors rendering system-only even with statusDot set', () => {
    const bar = createBarWith({
      ...DEFAULT_DANMAKU_KIT_THEME,
      statusDot: true,
    });
    (bar as unknown as { _scene: { forcedColors: boolean } })._scene = {
      forcedColors: true,
    };
    const { calls, renderer } = recordingRenderer();

    bar.render(renderer);

    expect(calls.some((call) => call.op === 'arc')).toBe(false);
    // Color arguments only, by each op's signature: fill()/stroke() carry the
    // color first (stroke's trailing lineWidth is a number), fillText() last.
    const colors = calls
      .filter((call) => call.op === 'fill' || call.op === 'stroke' || call.op === 'fillText')
      .map((call) => (call.op === 'fillText' ? call.args[call.args.length - 1] : call.args[0]))
      .filter((color) => typeof color === 'string');
    expect(new Set(colors)).toEqual(new Set(['Canvas', 'CanvasText', 'Highlight']));
  });
});
