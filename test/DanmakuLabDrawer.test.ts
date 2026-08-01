import { describe, expect, test } from 'bun:test';
import { Entity, VectoJSEvent } from '@vectojs/core';
import { Button, Tabs } from '@vectojs/ui';

import { DanmakuLabDrawer } from '../src/ui/lab/DanmakuLabDrawer';
import { LabPanel } from '../src/ui/lab/LabPanel';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME } from '../src/ui/theme';

class FakePanel extends LabPanel<{ value: number }> {
  constructor(label: string) {
    super(label, `${label} scroll`);
  }

  override setState(_state: Readonly<{ value: number }>): void {}
}

function descendants(root: Entity): Entity[] {
  const result: Entity[] = [];
  for (const child of root.children) {
    result.push(child, ...descendants(child));
  }
  return result;
}

function createDrawer(open = true): {
  drawer: DanmakuLabDrawer<'videos' | 'throughput' | 'interactions' | 'devtools'>;
  panels: FakePanel[];
  activeChanges: string[];
  openChanges: boolean[];
} {
  const panels = [
    new FakePanel('Videos panel'),
    new FakePanel('Throughput panel'),
    new FakePanel('Interactions panel'),
    new FakePanel('DevTools panel'),
  ];
  const activeChanges: string[] = [];
  const openChanges: boolean[] = [];
  const drawer = new DanmakuLabDrawer({
    theme: DEFAULT_DANMAKU_KIT_THEME,
    labels: DEFAULT_DANMAKU_KIT_LABELS.lab,
    panels: [
      { id: 'videos', label: 'Videos', panel: panels[0]! },
      { id: 'throughput', label: 'Throughput', panel: panels[1]! },
      { id: 'interactions', label: 'Interactions', panel: panels[2]! },
      { id: 'devtools', label: 'DevTools', panel: panels[3]! },
    ],
    open,
    activeTab: 'videos',
    onOpenChange: (nextOpen) => openChanges.push(nextOpen),
    onActiveTabChange: (tabId) => activeChanges.push(tabId),
  });
  return { drawer, panels, activeChanges, openChanges };
}

describe('DanmakuLabDrawer', () => {
  test.each([420, 374, 1200])(
    'uses the supplied %ipx local width without owning placement',
    (width: number) => {
      const { drawer, panels } = createDrawer();

      drawer.setAvailableBounds({ width, height: 700 });

      expect(drawer.width).toBe(width);
      expect(drawer.x).toBe(0);
      expect(drawer.y).toBe(0);
      const tabs = descendants(drawer).find((entity): entity is Tabs => entity instanceof Tabs);
      expect(tabs).toBeDefined();
      const close = descendants(drawer).find(
        (entity): entity is Button =>
          entity instanceof Button &&
          entity.getA11yAttributes().label === DEFAULT_DANMAKU_KIT_LABELS.lab.close,
      );
      expect(close).toBeDefined();
      expect(close!.x + close!.width).toBeLessThanOrEqual(drawer.width);
      expect(tabs!.x + tabs!.width).toBeLessThanOrEqual(drawer.width);
      expect(tabs!.height).toBeGreaterThan(0);
      for (const panel of panels) {
        expect(panel.width).toBe(tabs!.width);
        expect(panel.height).toBe(tabs!.height - tabs!.effectiveTabBarHeight);
      }
    },
  );

  test('uses Tabs semantics and routes tab and visible close actions', () => {
    const { drawer, activeChanges, openChanges } = createDrawer();
    drawer.setAvailableBounds({ width: 420, height: 700 });
    const nodes = descendants(drawer);
    const tabs = nodes.find((entity): entity is Tabs => entity instanceof Tabs)!;
    const close = nodes.find(
      (entity): entity is Button =>
        entity instanceof Button &&
        entity.getA11yAttributes().label === DEFAULT_DANMAKU_KIT_LABELS.lab.close,
    )!;

    const tabNodes = descendants(tabs).filter(
      (entity) => entity.getA11yAttributes().role === 'tab',
    );
    expect(tabNodes).toHaveLength(4);
    expect(tabNodes.map((entity) => entity.getA11yAttributes().label)).toEqual([
      'Videos',
      'Throughput',
      'Interactions',
      'DevTools',
    ]);
    expect(tabNodes.filter((entity) => entity.getA11yAttributes().tabIndex === 0)).toHaveLength(1);

    tabs.selectTab('throughput');
    expect(drawer.activeTab).toBe('throughput');
    expect(activeChanges).toEqual(['throughput']);

    close.dispatchEvent(new VectoJSEvent('click', close));
    expect(openChanges).toEqual([false]);
    expect(drawer.isOpen).toBe(false);
  });

  test('removes every interactive descendant while closed and reuses them on reopen', () => {
    const { drawer, panels } = createDrawer();
    drawer.setAvailableBounds({ width: 374, height: 640 });
    const firstPanel = panels[0]!;

    drawer.setOpen(false);

    expect(drawer.interactive).toBe(false);
    expect(drawer.a11yHidden).toBe(true);
    expect(drawer.children).toHaveLength(0);
    expect(descendants(drawer).filter((entity) => entity.interactive)).toHaveLength(0);

    drawer.setOpen(true);
    expect(drawer.interactive).toBe(true);
    expect(descendants(drawer)).toContain(firstPanel);
  });
});
