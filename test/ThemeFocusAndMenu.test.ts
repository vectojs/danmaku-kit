import { describe, expect, it } from 'bun:test';
import type { Entity } from '@vectojs/core';
import { Button, Dropdown, Slider } from '@vectojs/ui';
import { DanmakuCommandDeck } from '../src/ui/command/DanmakuCommandDeck';
import { DanmakuLabDrawer } from '../src/ui/lab/DanmakuLabDrawer';
import { DevToolsInfoPanel } from '../src/ui/lab/DevToolsInfoPanel';
import { ThroughputPanel } from '../src/ui/lab/ThroughputPanel';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME, type DanmakuKitTheme } from '../src/ui/theme';

/**
 * Deliberately unlike both the default theme and `@vectojs/ui`'s cyan/navy
 * fallbacks, so a control that silently keeps a library default fails rather
 * than coincidentally matching.
 */
const PROBE: DanmakuKitTheme = {
  ...DEFAULT_DANMAKU_KIT_THEME,
  focusRing: '#ff00aa',
  menuSurface: '#112233',
  menuSelected: '#445566',
  menuHighlight: '#778899',
};

const RING = PROBE.focusRing;

function descendants(root: Entity): Entity[] {
  const result: Entity[] = [root];
  for (const child of root.children) result.push(...descendants(child));
  return result;
}

function collect<T>(root: Entity, ctor: abstract new (...args: never[]) => T): T[] {
  return descendants(root).filter((node): node is T & Entity => node instanceof ctor) as T[];
}

function createDeck(): DanmakuCommandDeck {
  return new DanmakuCommandDeck({
    width: 760,
    compact: false,
    labels: DEFAULT_DANMAKU_KIT_LABELS,
    theme: PROBE,
    callbacks: {
      onSend: () => {},
      onPlayPause: () => {},
      onSeek: () => {},
      onRateChange: () => {},
      onToggleLab: () => {},
    },
  });
}

function createThroughputPanel(): ThroughputPanel<'even', 'p50', 'layout'> {
  return new ThroughputPanel({
    theme: PROBE,
    labels: {
      panel: 'Throughput laboratory',
      scroll: 'Throughput laboratory content',
      capacity: 'Capacity',
      target: 'Target',
      rate: 'Rate',
      quickTargets: 'Quick targets',
      distribution: 'Distribution',
      framePercentiles: 'Frame percentiles',
      drawSplit: 'Draw split',
      formatCapacity: String,
      formatTarget: String,
      formatRate: String,
      formatMetric: (value) => `${value} ms`,
    },
    state: {
      capacity: 5000,
      target: 500,
      rate: 50,
      distributionId: 'even',
      framePercentiles: { p50: 4 },
      drawSplit: { layout: 1 },
    },
    distributions: [{ id: 'even', label: 'Even' }],
    frameMetrics: [{ id: 'p50', label: 'p50' }],
    drawMetrics: [{ id: 'layout', label: 'Layout' }],
    targetRange: { min: 0, max: 5000, step: 100 },
    quickTargets: [{ value: 1000, label: '1K' }],
    rateRange: { min: 1, max: 1000, step: 1 },
    onTargetChange: () => {},
    onRateChange: () => {},
    onDistributionChange: () => {},
  });
}

function createDevToolsPanel(): DevToolsInfoPanel {
  return new DevToolsInfoPanel({
    theme: PROBE,
    labels: {
      panel: 'DevTools information',
      scroll: 'DevTools information content',
      title: 'Inspector status',
      reload: 'Reload inspector',
      availability: {
        available: 'Inspector available',
        unavailable: 'Inspector unavailable',
        'reload-required': 'Reload required',
      },
    },
    state: { availability: 'reload-required', canReload: true },
    onReload: () => {},
  });
}

describe('themed focus rings', () => {
  it('applies the ring to every command-deck Button and Slider', () => {
    const deck = createDeck();

    // Send, play/pause, lab toggle, plus the Dropdown's own trigger Button.
    const buttons = collect(deck, Button);
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) expect(button.focusColor).toBe(RING);

    const sliders = collect(deck, Slider);
    expect(sliders.length).toBeGreaterThanOrEqual(1);
    for (const slider of sliders) expect(slider.focusColor).toBe(RING);
  });

  it('applies the ring to both ThroughputPanel sliders', () => {
    const panel = createThroughputPanel();

    const sliders = collect(panel, Slider);
    expect(sliders).toHaveLength(2);
    for (const slider of sliders) {
      expect(slider.focusColor).toBe(RING);
      // Both already carried an accessible name. Guard it: a role="slider" with
      // no name is announced as a bare "slider".
      expect(slider.label).toBeTruthy();
    }
  });

  it('applies the ring to the DevToolsInfoPanel reload button', () => {
    const buttons = collect(createDevToolsPanel(), Button);
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    for (const button of buttons) expect(button.focusColor).toBe(RING);
  });

  it('applies the ring to the lab drawer close button', () => {
    const drawer = new DanmakuLabDrawer({
      theme: PROBE,
      labels: DEFAULT_DANMAKU_KIT_LABELS.lab,
      panels: [
        {
          id: 'throughput',
          label: 'Throughput',
          panel: createThroughputPanel(),
        },
      ],
      open: true,
      activeTab: 'throughput',
      onOpenChange: () => {},
      onActiveTabChange: () => {},
    });

    // The drawer's own close button, plus whatever the mounted panel carries.
    const buttons = collect(drawer, Button);
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    for (const button of buttons) expect(button.focusColor).toBe(RING);
  });
});

describe('themed dropdown menu', () => {
  it('themes the playback-rate menu so it cannot open on library defaults', () => {
    const [dropdown] = collect(createDeck(), Dropdown);
    expect(dropdown).toBeDefined();

    expect(dropdown!.menuBg).toBe('#112233');
    expect(dropdown!.menuSelectedBg).toBe('#445566');
    expect(dropdown!.menuHighlightBg).toBe('#778899');
    expect(dropdown!.menuColor).toBe(PROBE.text);
    expect(dropdown!.focusColor).toBe(RING);

    for (const value of [
      dropdown!.menuBg,
      dropdown!.menuSelectedBg,
      dropdown!.menuHighlightBg,
      dropdown!.focusColor,
    ]) {
      expect(value).not.toContain('240, 255');
      expect(value).not.toContain('15, 23, 42');
      expect(value).not.toBe('#00f0ff');
    }
  });

  it('keeps the default theme legible: the three menu row states differ', () => {
    const theme = DEFAULT_DANMAKU_KIT_THEME;
    expect(new Set([theme.menuSurface, theme.menuSelected, theme.menuHighlight]).size).toBe(3);
    // The ring must not vanish into the surface it is drawn against.
    expect(theme.focusRing).not.toBe(theme.menuSurface);
  });
});
