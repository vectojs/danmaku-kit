import { describe, expect, it } from 'bun:test';
import { Entity, type IRenderer } from '@vectojs/core';
import * as kit from '../src/index';
import * as model from '../src/model';
import * as ui from '../src/ui';

class DemoPanel extends Entity {
  public setAvailableBounds(bounds: Readonly<ui.LabAvailableBounds>): void {
    this.width = bounds.width;
    this.height = bounds.height;
  }

  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }

  public render(_renderer: IRenderer): void {}
}

describe('public package API', () => {
  it('exposes focused model and UI entry points from the root', () => {
    expect(kit.buildProfiledTrack).toBe(model.buildProfiledTrack);
    expect(kit.DanmakuStatusBar).toBe(ui.DanmakuStatusBar);
    expect(kit.DanmakuCommandDeck).toBe(ui.DanmakuCommandDeck);
    expect(kit.DanmakuLabDrawer).toBe(ui.DanmakuLabDrawer);
  });

  it('mounts reusable surfaces without Bakudan or browser globals', () => {
    const status = new ui.DanmakuStatusBar({
      width: 640,
      product: 'Second consumer',
      labels: ui.DEFAULT_DANMAKU_KIT_LABELS,
      theme: ui.DEFAULT_DANMAKU_KIT_THEME,
    });
    const deck = new ui.DanmakuCommandDeck({
      width: 760,
      labels: ui.DEFAULT_DANMAKU_KIT_LABELS,
      theme: ui.DEFAULT_DANMAKU_KIT_THEME,
      callbacks: {
        onSend: () => undefined,
        onPlayPause: () => undefined,
        onSeek: () => undefined,
        onRateChange: () => undefined,
        onToggleLab: () => undefined,
      },
    });
    const panel = new DemoPanel();
    const drawer = new ui.DanmakuLabDrawer({
      theme: ui.DEFAULT_DANMAKU_KIT_THEME,
      labels: ui.DEFAULT_DANMAKU_KIT_LABELS.lab,
      panels: [{ id: 'demo', label: 'Demo', panel }],
      open: true,
      activeTab: 'demo',
      onOpenChange: () => undefined,
      onActiveTabChange: () => undefined,
    });

    status.setStatus({ state: 'video', fps: 60, active: 500, capacity: 5_000, backend: 'test' });
    deck.setPlaybackState({
      currentTime: 2,
      duration: 10,
      playing: true,
      rate: 1,
      disabled: false,
    });
    drawer.setAvailableBounds({ width: 720, height: 320 });

    expect(status.getA11yAttributes().label).toContain('Second consumer');
    expect(deck.layoutSnapshot().lab.x + deck.layoutSnapshot().lab.width).toBeLessThanOrEqual(760);
    expect({ x: drawer.x, y: drawer.y, width: drawer.width, height: drawer.height }).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 320,
    });
    expect(panel.width).toBe(696);
    expect(panel.height).toBeGreaterThan(0);
    expect(panel.height).toBeLessThan(drawer.height);

    drawer.destroy();
    deck.destroy();
    status.destroy();
  });
});
