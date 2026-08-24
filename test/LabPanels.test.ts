import { describe, expect, test } from 'bun:test';
import { Entity, VectoJSEvent } from '@vectojs/core';
import { Button, Checkbox, Input, RadioGroup, ScrollView, Slider, Text } from '@vectojs/ui';

import { VideoSourceError, type VideoLoadState } from '../src/model';
import { DevToolsInfoPanel } from '../src/ui/lab/DevToolsInfoPanel';
import { InteractionsPanel } from '../src/ui/lab/InteractionsPanel';
import { ThroughputPanel } from '../src/ui/lab/ThroughputPanel';
import { VideosPanel } from '../src/ui/lab/VideosPanel';
import { DEFAULT_DANMAKU_KIT_THEME } from '../src/ui/theme';

function descendants(root: Entity): Entity[] {
  const result: Entity[] = [];
  for (const child of root.children) result.push(child, ...descendants(child));
  return result;
}

function labelledControlNames(root: Entity): Array<string | undefined> {
  const controlRoles = new Set(['button', 'checkbox', 'combobox', 'radio', 'slider', 'textbox']);
  return descendants(root)
    .map((entity) => entity.getA11yAttributes())
    .filter((attributes) => controlRoles.has(attributes.role ?? ''))
    .map((attributes) => attributes.label);
}

const loadStateLabel = (state: Readonly<Exclude<VideoLoadState, { status: 'error' }>>): string => {
  if (state.status === 'loading') return `Loading ${state.progress ?? 0}`;
  return state.status === 'ready' ? 'Ready' : 'Idle';
};

function createVideosPanel(callbacks: {
  choices: unknown[];
  retries: number[];
  customUrls: string[];
  uploads?: File[];
}): VideosPanel<'balanced' | 'dense'> {
  const uploads = callbacks.uploads;
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
      formatLoadState: loadStateLabel,
      formatLoadError: (error, candidateId) =>
        `${candidateId ?? 'unknown'}: ${error.code} ${error.message}`,
      formatMetadata: (rows) => rows.map((row) => `${row.label} ${row.value}`).join('\n'),
      formatAttribution: (value) => value,
    },
    state: {
      source: { kind: 'catalog', id: 'local' },
      profileId: 'balanced',
      loadState: {
        status: 'error',
        candidateId: 'local',
        error: new VideoSourceError('network-error', 'network'),
      },
    },
    catalog: [
      {
        id: 'local',
        title: 'Local clip',
        source: { kind: 'cdn', url: 'https://media.invalid/local.mp4' },
        metadata: [{ label: 'Duration', value: '15 seconds' }],
        attribution: 'Studio A',
      },
      {
        id: 'stream',
        title: 'Long stream',
        source: { kind: 'external', url: 'https://media.invalid/stream.mp4' },
        metadata: [
          { label: 'Resolution', value: '1080p' },
          { label: 'Duration', value: '10 minutes' },
        ],
        attribution: 'Studio B',
      },
    ],
    profiles: [
      { id: 'balanced', label: 'Balanced', description: 'Balanced tracks' },
      {
        id: 'dense',
        label: 'Dense',
        description: 'Dense tracks\nPinned interactions\nEffect overlays',
      },
    ],
    onChoose: (selection) => callbacks.choices.push(selection),
    onRetry: () => callbacks.retries.push(1),
    onCustomUrlChange: (url) => callbacks.customUrls.push(url),
    ...(uploads ? { onUploadFile: (file: File) => uploads.push(file) } : null),
  });
}

/**
 * Bun tests run DOM-free, so the picker handshake is exercised against a
 * recorded fake `<input>` installed as `document`. Each `createElement('input')`
 * yields a fresh record whose `click()` counts activations and whose captured
 * change listeners the test fires manually.
 */
interface RecordedFileInput {
  type: string;
  accept: string;
  value: string;
  files?: File[];
  clickCount: number;
  changeListeners: Array<() => void>;
  click(): void;
  addEventListener(type: string, listener: () => void): void;
}

function installFakeDocument(created: RecordedFileInput[]): void {
  const fakeDocument = {
    createElement(tag: string): RecordedFileInput | { getContext(): null } {
      // @vectojs/ui measures text through a 2d canvas context when it sees a
      // document; a null context sends it down the same metrics fallback it
      // uses DOM-free, keeping the rest of the panel construction honest.
      if (tag === 'canvas') return { getContext: () => null };
      if (tag !== 'input') throw new Error(`unexpected element: ${tag}`);
      const input: RecordedFileInput = {
        type: '',
        accept: '',
        value: '',
        files: undefined,
        clickCount: 0,
        changeListeners: [],
        click() {
          input.clickCount += 1;
        },
        addEventListener(type, listener) {
          if (type === 'change') input.changeListeners.push(listener);
        },
      };
      created.push(input);
      return input;
    },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
}

function uninstallFakeDocument(): void {
  Reflect.deleteProperty(globalThis, 'document');
}

function fireChange(input: RecordedFileInput): void {
  for (const listener of input.changeListeners) listener();
}

function createThroughputPanel(callbacks: {
  targets: number[];
  rates: number[];
  distributions: string[];
}): ThroughputPanel<'even' | 'burst', 'p50' | 'p95', 'layout' | 'draw'> {
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
      framePercentiles: { p50: 4, p95: 8 },
      drawSplit: { layout: 1, draw: 3 },
    },
    distributions: [
      { id: 'even', label: 'Even' },
      { id: 'burst', label: 'Burst' },
    ],
    frameMetrics: [
      { id: 'p50', label: 'p50' },
      { id: 'p95', label: 'p95' },
    ],
    drawMetrics: [
      { id: 'layout', label: 'Layout' },
      { id: 'draw', label: 'Draw' },
    ],
    targetRange: { min: 0, max: 5000, step: 100 },
    quickTargets: [
      { value: 1000, label: '1K' },
      { value: 2500, label: '2.5K' },
      { value: 5000, label: '5K' },
    ],
    rateRange: { min: 1, max: 1000, step: 1 },
    onTargetChange: (value) => callbacks.targets.push(value),
    onRateChange: (value) => callbacks.rates.push(value),
    onDistributionChange: (value) => callbacks.distributions.push(value),
  });
}

function createInteractionsPanel(callbacks: {
  presets: string[];
  effects: Array<[string, boolean]>;
}): InteractionsPanel<'plain' | 'jelly', 'glow' | 'outline', 'text' | 'emoji'> {
  return new InteractionsPanel({
    theme: DEFAULT_DANMAKU_KIT_THEME,
    labels: {
      panel: 'Interactions laboratory',
      scroll: 'Interactions laboratory content',
      presets: 'Presets',
      effects: 'Effects',
      renderClasses: 'Render classes',
    },
    state: {
      presetId: 'plain',
      effects: { glow: false, outline: true },
      renderClasses: { text: 'glyph atlas', emoji: 'sprite' },
    },
    presets: [
      { id: 'plain', label: 'Plain motion' },
      { id: 'jelly', label: 'Jelly motion' },
    ],
    effects: [
      { id: 'glow', label: 'Glow effect' },
      { id: 'outline', label: 'Outline effect' },
    ],
    renderClasses: [
      { id: 'text', label: 'Text class' },
      { id: 'emoji', label: 'Emoji class' },
    ],
    onPresetChange: (value) => callbacks.presets.push(value),
    onEffectChange: (id, enabled) => callbacks.effects.push([id, enabled]),
  });
}

describe('laboratory panels', () => {
  test('VideosPanel uses injected catalog/profile data and routes custom, Choose, and Retry callbacks', () => {
    const callbacks = {
      choices: [] as unknown[],
      retries: [] as number[],
      customUrls: [] as string[],
    };
    const panel = createVideosPanel(callbacks);
    panel.setAvailableBounds({ width: 374, height: 560 });
    const nodes = descendants(panel);
    const groups = nodes.filter((entity): entity is RadioGroup => entity instanceof RadioGroup);
    const input = nodes.find((entity): entity is Input => entity instanceof Input)!;
    const choose = nodes.find(
      (entity): entity is Button =>
        entity instanceof Button && entity.getA11yAttributes().label === 'Choose source',
    )!;
    const retry = nodes.find(
      (entity): entity is Button =>
        entity instanceof Button && entity.getA11yAttributes().label === 'Retry load',
    )!;
    const scroll = nodes.find((entity): entity is ScrollView => entity instanceof ScrollView)!;
    const initialContentHeight = scroll.content.height;
    expect(
      nodes
        .filter((entity): entity is Text => entity instanceof Text)
        .some((text) => text.getContentProjection()?.text === 'local: network-error network'),
    ).toBe(true);

    groups[0]!.selectByValue('catalog:1');
    expect(scroll.content.height).toBeGreaterThan(initialContentHeight);
    expect(
      nodes
        .filter((entity): entity is Text => entity instanceof Text)
        .some(
          (text) => text.getContentProjection()?.text === 'Resolution 1080p\nDuration 10 minutes',
        ),
    ).toBe(true);
    const sourceContentHeight = scroll.content.height;
    groups[1]!.selectByValue('profile:1');
    expect(scroll.content.height).toBeGreaterThan(sourceContentHeight);
    expect(
      nodes
        .filter((entity): entity is Text => entity instanceof Text)
        .some(
          (text) =>
            text.getContentProjection()?.text ===
            'Dense tracks\nPinned interactions\nEffect overlays',
        ),
    ).toBe(true);
    choose.dispatchEvent(new VectoJSEvent('click', choose));
    retry.dispatchEvent(new VectoJSEvent('click', retry));
    input.emit('change', { value: 'https://media.invalid/custom.mp4' });
    choose.dispatchEvent(new VectoJSEvent('click', choose));

    expect(callbacks.choices).toEqual([
      { source: { kind: 'catalog', id: 'stream' }, profileId: 'dense' },
      { source: { kind: 'custom', url: 'https://media.invalid/custom.mp4' }, profileId: 'dense' },
    ]);
    expect(callbacks.retries).toEqual([1]);
    expect(callbacks.customUrls).toEqual(['https://media.invalid/custom.mp4']);
    expect(labelledControlNames(panel)).not.toContain(undefined);
  });

  test('VideosPanel upload affordance hands picked local videos through onUploadFile', () => {
    const inputs: RecordedFileInput[] = [];
    installFakeDocument(inputs);
    try {
      const uploads: File[] = [];
      const panel = createVideosPanel({ choices: [], retries: [], customUrls: [], uploads });
      panel.setAvailableBounds({ width: 374, height: 560 });
      const upload = descendants(panel).find(
        (entity): entity is Button =>
          entity instanceof Button && entity.getA11yAttributes().label === 'Upload local file',
      )!;
      expect(upload.getA11yAttributes()).toMatchObject({
        role: 'button',
        label: 'Upload local file',
      });

      const clip = new File(['clip-bytes'], 'holiday.mp4', { type: 'video/mp4' });
      upload.dispatchEvent(new VectoJSEvent('click', upload));
      const [first] = inputs;
      expect(first).toMatchObject({ type: 'file', accept: 'video/*' });
      expect(first!.clickCount).toBe(1);
      expect(uploads).toEqual([]);

      first!.files = [clip];
      fireChange(first!);
      expect(uploads).toEqual([clip]);
      expect(first!.value).toBe('');

      upload.dispatchEvent(new VectoJSEvent('click', upload));
      const second = inputs[1]!;
      second.files = [clip];
      fireChange(second);
      expect(uploads).toEqual([clip, clip]);

      upload.dispatchEvent(new VectoJSEvent('click', upload));
      inputs[2]!.files = [];
      fireChange(inputs[2]!);
      expect(uploads).toEqual([clip, clip]);
    } finally {
      uninstallFakeDocument();
    }
  });

  test('VideosPanel renders no upload affordance without onUploadFile', () => {
    const panel = createVideosPanel({ choices: [], retries: [], customUrls: [] });
    panel.setAvailableBounds({ width: 374, height: 560 });
    expect(
      descendants(panel).some(
        (entity) =>
          entity instanceof Button && entity.getA11yAttributes().label === 'Upload local file',
      ),
    ).toBe(false);
  });

  test('ThroughputPanel consumes injected metrics and routes only control values', () => {
    const callbacks = {
      targets: [] as number[],
      rates: [] as number[],
      distributions: [] as string[],
    };
    const panel = createThroughputPanel(callbacks);
    panel.setAvailableBounds({ width: 420, height: 560 });
    const nodes = descendants(panel);
    const sliders = nodes.filter((entity): entity is Slider => entity instanceof Slider);
    const [quickTargets, distribution] = nodes.filter(
      (entity): entity is RadioGroup => entity instanceof RadioGroup,
    );

    sliders[0]!.emit('change', { value: 900 });
    sliders[1]!.emit('change', { value: 75 });
    quickTargets!.selectByValue('5000');
    distribution!.selectByValue('burst');

    expect(callbacks.targets).toEqual([900, 5000]);
    expect(callbacks.rates).toEqual([75]);
    expect(callbacks.distributions).toEqual(['burst']);
    expect(sliders.map((slider) => slider.getA11yAttributes().label)).toEqual(['Target', 'Rate']);
    expect(quickTargets!.options.map((option) => option.label)).toEqual(['1K', '2.5K', '5K']);
    expect(quickTargets!.value).toBe('5000');
  });

  test('InteractionsPanel uses labelled built-in checkboxes and preset semantics', () => {
    const callbacks = { presets: [] as string[], effects: [] as Array<[string, boolean]> };
    const panel = createInteractionsPanel(callbacks);
    panel.setAvailableBounds({ width: 374, height: 560 });
    const nodes = descendants(panel);
    const preset = nodes.find((entity): entity is RadioGroup => entity instanceof RadioGroup)!;
    const checkboxes = nodes.filter((entity): entity is Checkbox => entity instanceof Checkbox);

    preset.selectByValue('jelly');
    checkboxes[0]!.dispatchEvent(new VectoJSEvent('click', checkboxes[0]!));

    expect(callbacks.presets).toEqual(['jelly']);
    expect(callbacks.effects).toEqual([['glow', true]]);
    expect(checkboxes.map((checkbox) => checkbox.getA11yAttributes().label)).toEqual([
      'Glow effect',
      'Outline effect',
    ]);
  });

  test('DevToolsInfoPanel exposes injected availability and reload action without rebuilding', () => {
    const reloads: number[] = [];
    const panel = new DevToolsInfoPanel({
      theme: DEFAULT_DANMAKU_KIT_THEME,
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
      state: { availability: 'unavailable', canReload: false },
      onReload: () => reloads.push(1),
    });
    panel.setAvailableBounds({ width: 420, height: 300 });
    const reload = descendants(panel).find((entity): entity is Button => entity instanceof Button)!;
    expect(reload.getA11yAttributes()).toMatchObject({
      role: 'button',
      label: 'Reload inspector',
      disabled: true,
    });

    panel.setState({ availability: 'reload-required', canReload: true });
    reload.dispatchEvent(new VectoJSEvent('click', reload));

    expect(reloads).toEqual([1]);
    expect(reload.getA11yAttributes().disabled).toBeUndefined();
  });

  test.each([420, 374])(
    'keeps one ScrollView owner and named controls at %ipx',
    (width: number) => {
      const videos = createVideosPanel({ choices: [], retries: [], customUrls: [] });
      const throughput = createThroughputPanel({ targets: [], rates: [], distributions: [] });
      const interactions = createInteractionsPanel({ presets: [], effects: [] });
      const panels = [videos, throughput, interactions];

      for (const panel of panels) {
        panel.setAvailableBounds({ width, height: 560 });
        expect(panel.width).toBe(width);
        expect(descendants(panel).filter((entity) => entity instanceof ScrollView)).toHaveLength(1);
        expect(
          labelledControlNames(panel).every(
            (label) => typeof label === 'string' && label.length > 0,
          ),
        ).toBe(true);
      }
    },
  );
});
