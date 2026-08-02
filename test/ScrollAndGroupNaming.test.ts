import { describe, expect, test } from 'bun:test';
import { Entity } from '@vectojs/core';
import { RadioGroup, ScrollView, Tabs } from '@vectojs/ui';

import { DanmakuLabDrawer } from '../src/ui/lab/DanmakuLabDrawer';
import { InteractionsPanel } from '../src/ui/lab/InteractionsPanel';
import { ThroughputPanel } from '../src/ui/lab/ThroughputPanel';
import { VideosPanel } from '../src/ui/lab/VideosPanel';
import { DEFAULT_DANMAKU_KIT_LABELS } from '../src/ui/labels';
import { DEFAULT_DANMAKU_KIT_THEME } from '../src/ui/theme';

function descendants(root: Entity): Entity[] {
  const result: Entity[] = [];
  for (const child of root.children) result.push(child, ...descendants(child));
  return result;
}

function scrollViews(root: Entity): ScrollView[] {
  return descendants(root).filter((entity): entity is ScrollView => entity instanceof ScrollView);
}

function radioGroups(root: Entity): RadioGroup[] {
  return descendants(root).filter((entity): entity is RadioGroup => entity instanceof RadioGroup);
}

function makeVideosPanel(): VideosPanel<'balanced'> {
  return new VideosPanel({
    theme: DEFAULT_DANMAKU_KIT_THEME,
    labels: {
      panel: 'Video laboratory',
      scroll: 'Video laboratory content',
      videos: 'Sources',
      profiles: 'Profiles',
      profileDetails: 'Profile details',
      metadata: 'Metadata',
      attribution: 'Attribution',
      customUrl: 'Custom media URL',
      customSource: 'Custom source',
      choose: 'Choose source',
      retry: 'Retry load',
      loadState: 'Load state',
      formatLoadState: () => 'Idle',
      formatLoadError: (error) => error.code,
      formatMetadata: (rows) => rows.map((row) => `${row.label} ${row.value}`).join('\n'),
      formatAttribution: (value) => value,
    },
    state: {
      source: { kind: 'catalog', id: 'local' },
      profileId: 'balanced',
      loadState: { status: 'idle' },
    },
    catalog: [
      {
        id: 'local',
        title: 'Local clip',
        source: { kind: 'cdn', url: 'https://media.invalid/local.mp4' },
        metadata: [{ label: 'Duration', value: '15 seconds' }],
        attribution: 'Studio A',
      },
    ],
    profiles: [{ id: 'balanced', label: 'Balanced', description: 'Balanced tracks' }],
    onChoose: () => {},
    onRetry: () => {},
    onCustomUrlChange: () => {},
  });
}

function makeThroughputPanel(): ThroughputPanel<'even', 'p50', 'draw'> {
  return new ThroughputPanel({
    theme: DEFAULT_DANMAKU_KIT_THEME,
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
      drawSplit: { draw: 3 },
    },
    distributions: [{ id: 'even', label: 'Steady' }],
    frameMetrics: [{ id: 'p50', label: 'p50' }],
    drawMetrics: [{ id: 'draw', label: 'Draw' }],
    targetRange: { min: 0, max: 5000, step: 100 },
    quickTargets: [
      { value: 1000, label: '1K' },
      { value: 5000, label: '5K' },
    ],
    rateRange: { min: 1, max: 1000, step: 1 },
    onTargetChange: () => {},
    onRateChange: () => {},
    onDistributionChange: () => {},
  });
}

function makeInteractionsPanel(): InteractionsPanel<'scroll', 'glow', 'text'> {
  return new InteractionsPanel({
    theme: DEFAULT_DANMAKU_KIT_THEME,
    labels: {
      panel: 'Interactions laboratory',
      scroll: 'Interactions laboratory content',
      presets: 'Motion presets',
      effects: 'Effects',
      renderClasses: 'Render classes',
    },
    state: {
      presetId: 'scroll',
      effects: { glow: true },
      renderClasses: { text: 'glyph atlas' },
    },
    presets: [{ id: 'scroll', label: 'Scroll' }],
    effects: [{ id: 'glow', label: 'Glow effect' }],
    renderClasses: [{ id: 'text', label: 'Text class' }],
    onPresetChange: () => {},
    onEffectChange: () => {},
  });
}

describe('lab panels stay mouse-scrollable', () => {
  // ScrollView implements scrolling only through node events (wheel + drag),
  // and those are dispatched from the projected a11y element. Suppressing
  // pointer events on it silently disables mouse scrolling entirely while
  // leaving keyboard scrolling intact, which is the regression this pins.
  test('the scrolling element does not suppress pointer events', () => {
    for (const panel of [makeVideosPanel(), makeThroughputPanel(), makeInteractionsPanel()]) {
      const views = scrollViews(panel);
      expect(views.length).toBeGreaterThan(0);
      for (const view of views) {
        expect(view.interactive).toBe(true);
        expect(view.getA11yAttributes().pointerEvents).toBeUndefined();
      }
    }
  });

  test('the outer panel region stays pointer-transparent so the wheel reaches the scroll view', () => {
    // The panel region exactly covers its ScrollView child. A descendant that
    // re-enables pointer events stays targetable inside a `none` ancestor, but
    // an ancestor left at `auto` would swallow the wheel first.
    for (const panel of [makeVideosPanel(), makeThroughputPanel(), makeInteractionsPanel()]) {
      expect(panel.getA11yAttributes().pointerEvents).toBe('none');
    }
  });

  test('the scroll region keeps its accessible name', () => {
    const names = scrollViews(makeVideosPanel()).map((view) => view.getA11yAttributes().label);
    expect(names).toContain('Video laboratory content');
  });
});

describe('group containers carry distinct accessible names', () => {
  test('every RadioGroup names itself rather than defaulting to "Radio group"', () => {
    const groups = [
      ...radioGroups(makeVideosPanel()),
      ...radioGroups(makeThroughputPanel()),
      ...radioGroups(makeInteractionsPanel()),
    ];
    expect(groups.length).toBe(5);
    const names = groups.map((group) => group.getA11yAttributes().label);
    expect(names).not.toContain('Radio group');
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'Sources',
        'Profiles',
        'Quick targets',
        'Distribution',
        'Motion presets',
      ]),
    );
  });

  test('the lab tablist names itself rather than defaulting to "Tab switching panel"', () => {
    const drawer = new DanmakuLabDrawer({
      theme: DEFAULT_DANMAKU_KIT_THEME,
      labels: DEFAULT_DANMAKU_KIT_LABELS.lab,
      panels: [
        { id: 'videos', label: 'Videos', panel: makeVideosPanel() },
        { id: 'throughput', label: 'Throughput', panel: makeThroughputPanel() },
      ],
      activeTab: 'videos',
      open: true,
      onOpenChange: () => {},
      onActiveTabChange: () => {},
    });

    const tabs = descendants(drawer).filter((entity): entity is Tabs => entity instanceof Tabs);
    expect(tabs.length).toBe(1);
    const label = tabs[0]?.getA11yAttributes().label;
    expect(label).not.toBe('Tab switching panel');
    expect(label).toBe(DEFAULT_DANMAKU_KIT_LABELS.lab.title);
  });
});
