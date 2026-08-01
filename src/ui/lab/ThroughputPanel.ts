import { RadioGroup, Slider, Text } from '@vectojs/ui';

import type { DanmakuKitTheme } from '../theme';
import { LabPanel } from './LabPanel';

export interface ThroughputChoiceRow<Id extends string> {
  id: Id;
  label: string;
}

export interface ThroughputMetricDefinition<Id extends string> {
  id: Id;
  label: string;
}

export interface ThroughputPanelState<
  DistributionId extends string,
  FrameMetricId extends string,
  DrawMetricId extends string,
> {
  capacity: number;
  target: number;
  rate: number;
  distributionId: DistributionId;
  framePercentiles: Readonly<Record<FrameMetricId, number>>;
  drawSplit: Readonly<Record<DrawMetricId, number>>;
}

export interface ThroughputPanelLabels {
  panel: string;
  scroll: string;
  capacity: string;
  target: string;
  rate: string;
  distribution: string;
  framePercentiles: string;
  drawSplit: string;
  formatCapacity: (value: number) => string;
  formatTarget: (value: number) => string;
  formatRate: (value: number) => string;
  formatMetric: (value: number) => string;
}

export interface ThroughputPanelOptions<
  DistributionId extends string,
  FrameMetricId extends string,
  DrawMetricId extends string,
> {
  theme: Readonly<DanmakuKitTheme>;
  labels: Readonly<ThroughputPanelLabels>;
  state: Readonly<ThroughputPanelState<DistributionId, FrameMetricId, DrawMetricId>>;
  distributions: ReadonlyArray<Readonly<ThroughputChoiceRow<DistributionId>>>;
  frameMetrics: ReadonlyArray<Readonly<ThroughputMetricDefinition<FrameMetricId>>>;
  drawMetrics: ReadonlyArray<Readonly<ThroughputMetricDefinition<DrawMetricId>>>;
  targetRange: Readonly<{ min: number; max: number; step: number }>;
  rateRange: Readonly<{ min: number; max: number; step: number }>;
  onTargetChange: (target: number) => void;
  onRateChange: (rate: number) => void;
  onDistributionChange: (distributionId: DistributionId) => void;
}

export class ThroughputPanel<
  DistributionId extends string,
  FrameMetricId extends string,
  DrawMetricId extends string,
> extends LabPanel<ThroughputPanelState<DistributionId, FrameMetricId, DrawMetricId>> {
  private readonly capacityValue: Text;
  private readonly targetValue: Text;
  private readonly rateValue: Text;
  private readonly targetSlider: Slider;
  private readonly rateSlider: Slider;
  private readonly distributionGroup: RadioGroup;
  private readonly frameValues = new Map<FrameMetricId, Text>();
  private readonly drawValues = new Map<DrawMetricId, Text>();
  private readonly texts: Text[] = [];

  constructor(
    private readonly options: ThroughputPanelOptions<DistributionId, FrameMetricId, DrawMetricId>,
  ) {
    super(options.labels.panel, options.labels.scroll);

    this.capacityValue = this.addValue(options.labels.capacity);
    this.targetValue = this.addValue(options.labels.target);
    this.targetSlider = new Slider({
      ...options.targetRange,
      value: options.state.target,
      width: 1,
      height: 24,
      label: options.labels.target,
      trackColor: options.theme.border,
      progressColor: options.theme.accent,
      handleColor: options.theme.text,
      onChange: options.onTargetChange,
    });
    this.content.add(this.targetSlider);

    this.rateValue = this.addValue(options.labels.rate);
    this.rateSlider = new Slider({
      ...options.rateRange,
      value: options.state.rate,
      width: 1,
      height: 24,
      label: options.labels.rate,
      trackColor: options.theme.border,
      progressColor: options.theme.signal,
      handleColor: options.theme.text,
      onChange: options.onRateChange,
    });
    this.content.add(this.rateSlider);

    this.addHeading(options.labels.distribution);
    this.distributionGroup = new RadioGroup({
      options: options.distributions.map((row) => ({ value: row.id, label: row.label })),
      value: options.state.distributionId,
      direction: 'vertical',
      gap: 10,
      font: options.theme.fontUi,
      color: options.theme.text,
      accent: options.theme.accent,
      border: options.theme.border,
      onChange: (id) => options.onDistributionChange(id as DistributionId),
    });
    this.content.add(this.distributionGroup);

    this.addHeading(options.labels.framePercentiles);
    for (const metric of options.frameMetrics) {
      this.frameValues.set(metric.id, this.addValue(metric.label));
    }

    this.addHeading(options.labels.drawSplit);
    for (const metric of options.drawMetrics) {
      this.drawValues.set(metric.id, this.addValue(metric.label));
    }

    this.setState(options.state);
    this.relayoutContent();
  }

  override setState(
    state: Readonly<ThroughputPanelState<DistributionId, FrameMetricId, DrawMetricId>>,
  ): void {
    const { labels } = this.options;
    this.capacityValue.setText(`${labels.capacity}: ${labels.formatCapacity(state.capacity)}`);
    this.targetValue.setText(`${labels.target}: ${labels.formatTarget(state.target)}`);
    this.rateValue.setText(`${labels.rate}: ${labels.formatRate(state.rate)}`);
    this.targetSlider.value = state.target;
    this.rateSlider.value = state.rate;
    this.distributionGroup.value = state.distributionId;

    for (const metric of this.options.frameMetrics) {
      this.frameValues
        .get(metric.id)
        ?.setText(`${metric.label}: ${labels.formatMetric(state.framePercentiles[metric.id])}`);
    }
    for (const metric of this.options.drawMetrics) {
      this.drawValues
        .get(metric.id)
        ?.setText(`${metric.label}: ${labels.formatMetric(state.drawSplit[metric.id])}`);
    }

    this.relayoutContent();
  }

  protected override layoutContent(contentWidth: number): void {
    this.targetSlider.width = contentWidth;
    this.rateSlider.width = contentWidth;
    for (const text of this.texts) text.setMaxWidth(contentWidth);
  }

  protected override onForcedColorsChange(forced: boolean): void {
    const { theme } = this.options;
    for (const text of this.texts) text.color = forced ? 'CanvasText' : theme.text;
    this.distributionGroup.color = forced ? 'CanvasText' : theme.text;
    this.distributionGroup.accent = forced ? 'Highlight' : theme.accent;
    this.distributionGroup.border = forced ? 'CanvasText' : theme.border;
  }

  private addHeading(label: string): Text {
    const text = new Text(label, {
      font: this.options.theme.fontLabel,
      color: this.options.theme.textMuted,
      maxWidth: 1,
    });
    this.texts.push(text);
    this.content.add(text);
    return text;
  }

  private addValue(label: string): Text {
    const text = new Text(label, {
      font: this.options.theme.fontMono,
      color: this.options.theme.text,
      maxWidth: 1,
    });
    this.texts.push(text);
    this.content.add(text);
    return text;
  }
}
