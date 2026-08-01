import { describe, expect, it } from 'bun:test';
import type { IRenderer } from '@vectojs/core';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME } from '../src/ui/theme';
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
    (bar as unknown as { _scene: { forcedColors: boolean } })._scene = { forcedColors: true };

    bar.render(renderer);

    expect(colors.length).toBeGreaterThan(0);
    expect(new Set(colors)).toEqual(new Set(['Canvas', 'CanvasText', 'Highlight']));
  });
});
