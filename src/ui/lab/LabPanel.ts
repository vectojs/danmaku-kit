import { type A11yAttributes, type IRenderer } from '@vectojs/core';
import { ScrollView, Stack, UIComponent } from '@vectojs/ui';

export interface LabAvailableBounds {
  width: number;
  height: number;
}

export interface LabPanelContract<State> {
  setState(state: Readonly<State>): void;
  setAvailableBounds(bounds: Readonly<LabAvailableBounds>): void;
}

export interface LabPanelCallbacks<State> {
  onStateChange?: (state: Readonly<State>) => void;
}

class LabelledScrollView extends ScrollView {
  constructor(
    bounds: Readonly<LabAvailableBounds>,
    private readonly accessibleLabel: string,
  ) {
    super(bounds);
  }

  override getA11yAttributes(): A11yAttributes {
    return {
      role: 'region',
      label: this.accessibleLabel,
      pointerEvents: 'none',
    };
  }
}

/**
 * Canvas-native base for a laboratory tab. It owns the tab's only vertical
 * ScrollView and keeps the same entity tree while state and bounds change.
 */
export abstract class LabPanel<State> extends UIComponent implements LabPanelContract<State> {
  protected readonly scrollView: ScrollView;
  protected readonly content: Stack;
  protected contentWidth = 1;

  private forcedColors: boolean | undefined;

  protected constructor(
    private readonly accessibleLabel: string,
    scrollLabel: string,
  ) {
    super();
    this.interactive = true;

    this.scrollView = new LabelledScrollView({ width: 1, height: 1 }, scrollLabel);
    this.content = new Stack({ direction: 'vertical', gap: 14 });
    this.scrollView.add(this.content);
    this.add(this.scrollView);
  }

  abstract setState(state: Readonly<State>): void;

  setAvailableBounds(bounds: Readonly<LabAvailableBounds>): void {
    this.width = Math.max(0, bounds.width);
    this.height = Math.max(0, bounds.height);
    this.scrollView.width = this.width;
    this.scrollView.height = this.height;
    this.contentWidth = Math.max(1, this.width - 24);
    this.content.x = 12;
    this.content.y = 12;
    this.layoutContent(this.contentWidth);
    this.relayoutContent();
  }

  protected layoutContent(_contentWidth: number): void {}

  protected relayoutContent(): void {
    this.content.layout();
    this.scrollView.updateContentSize();
    this.scene?.markDirty();
  }

  protected onForcedColorsChange(_forced: boolean): void {}

  override getA11yAttributes(): A11yAttributes {
    return {
      role: 'region',
      label: this.accessibleLabel,
      pointerEvents: 'none',
    };
  }

  override render(_renderer: IRenderer): void {
    const forced = this.scene?.forcedColors ?? false;
    if (forced === this.forcedColors) return;
    this.forcedColors = forced;
    this.onForcedColorsChange(forced);
  }
}
