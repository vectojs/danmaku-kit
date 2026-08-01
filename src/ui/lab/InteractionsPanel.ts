import { Checkbox, RadioGroup, Text } from '@vectojs/ui';

import type { DanmakuKitTheme } from '../theme';
import { LabPanel } from './LabPanel';

export interface InteractionChoiceRow<Id extends string> {
  id: Id;
  label: string;
}

export interface InteractionEffectRow<Id extends string> extends InteractionChoiceRow<Id> {}

export interface RenderClassDefinition<Id extends string> {
  id: Id;
  label: string;
}

export interface InteractionsPanelState<
  PresetId extends string,
  EffectId extends string,
  RenderClassId extends string,
> {
  presetId: PresetId;
  effects: Readonly<Record<EffectId, boolean>>;
  renderClasses: Readonly<Record<RenderClassId, string>>;
}

export interface InteractionsPanelLabels {
  panel: string;
  scroll: string;
  presets: string;
  effects: string;
  renderClasses: string;
}

export interface InteractionsPanelOptions<
  PresetId extends string,
  EffectId extends string,
  RenderClassId extends string,
> {
  theme: Readonly<DanmakuKitTheme>;
  labels: Readonly<InteractionsPanelLabels>;
  state: Readonly<InteractionsPanelState<PresetId, EffectId, RenderClassId>>;
  presets: ReadonlyArray<Readonly<InteractionChoiceRow<PresetId>>>;
  effects: ReadonlyArray<Readonly<InteractionEffectRow<EffectId>>>;
  renderClasses: ReadonlyArray<Readonly<RenderClassDefinition<RenderClassId>>>;
  onPresetChange: (presetId: PresetId) => void;
  onEffectChange: (effectId: EffectId, enabled: boolean) => void;
}

export class InteractionsPanel<
  PresetId extends string,
  EffectId extends string,
  RenderClassId extends string,
> extends LabPanel<InteractionsPanelState<PresetId, EffectId, RenderClassId>> {
  private readonly presetGroup: RadioGroup;
  private readonly effectControls = new Map<EffectId, Checkbox>();
  private readonly renderClassValues = new Map<RenderClassId, Text>();
  private readonly texts: Text[] = [];

  constructor(
    private readonly options: InteractionsPanelOptions<PresetId, EffectId, RenderClassId>,
  ) {
    super(options.labels.panel, options.labels.scroll);

    this.addHeading(options.labels.presets);
    this.presetGroup = new RadioGroup({
      options: options.presets.map((row) => ({ value: row.id, label: row.label })),
      value: options.state.presetId,
      direction: 'vertical',
      gap: 10,
      font: options.theme.fontUi,
      color: options.theme.text,
      accent: options.theme.accent,
      border: options.theme.border,
      onChange: (id) => options.onPresetChange(id as PresetId),
    });
    this.content.add(this.presetGroup);

    this.addHeading(options.labels.effects);
    for (const effect of options.effects) {
      const control = new Checkbox({
        label: effect.label,
        checked: options.state.effects[effect.id],
        font: options.theme.fontUi,
        color: options.theme.text,
        accent: options.theme.accent,
        border: options.theme.border,
        onChange: (enabled) => options.onEffectChange(effect.id, enabled),
      });
      this.effectControls.set(effect.id, control);
      this.content.add(control);
    }

    this.addHeading(options.labels.renderClasses);
    for (const renderClass of options.renderClasses) {
      const value = new Text(renderClass.label, {
        font: options.theme.fontMono,
        color: options.theme.text,
        maxWidth: 1,
      });
      this.texts.push(value);
      this.renderClassValues.set(renderClass.id, value);
      this.content.add(value);
    }

    this.setState(options.state);
    this.relayoutContent();
  }

  override setState(
    state: Readonly<InteractionsPanelState<PresetId, EffectId, RenderClassId>>,
  ): void {
    this.presetGroup.value = state.presetId;
    for (const effect of this.options.effects) {
      const control = this.effectControls.get(effect.id);
      if (control) control.checked = state.effects[effect.id];
    }
    for (const renderClass of this.options.renderClasses) {
      this.renderClassValues
        .get(renderClass.id)
        ?.setText(`${renderClass.label}: ${state.renderClasses[renderClass.id]}`);
    }
    this.relayoutContent();
  }

  protected override layoutContent(contentWidth: number): void {
    for (const text of this.texts) text.setMaxWidth(contentWidth);
  }

  protected override onForcedColorsChange(forced: boolean): void {
    const { theme } = this.options;
    for (const text of this.texts) text.color = forced ? 'CanvasText' : theme.text;
    this.presetGroup.color = forced ? 'CanvasText' : theme.text;
    this.presetGroup.accent = forced ? 'Highlight' : theme.accent;
    this.presetGroup.border = forced ? 'CanvasText' : theme.border;
    for (const control of this.effectControls.values()) {
      control.color = forced ? 'CanvasText' : theme.text;
      control.accent = forced ? 'Highlight' : theme.accent;
      control.border = forced ? 'CanvasText' : theme.border;
    }
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
}
