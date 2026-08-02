import { Button, Text } from '@vectojs/ui';

import type { DanmakuKitTheme } from '../theme';
import { LabPanel } from './LabPanel';

export type DevToolsAvailability = 'available' | 'unavailable' | 'reload-required';

export interface DevToolsInfoPanelState {
  availability: DevToolsAvailability;
  canReload: boolean;
}

export interface DevToolsInfoPanelLabels {
  panel: string;
  scroll: string;
  title: string;
  reload: string;
  availability: Readonly<Record<DevToolsAvailability, string>>;
}

export interface DevToolsInfoPanelOptions {
  theme: Readonly<DanmakuKitTheme>;
  labels: Readonly<DevToolsInfoPanelLabels>;
  state: Readonly<DevToolsInfoPanelState>;
  onReload: () => void;
}

export class DevToolsInfoPanel extends LabPanel<DevToolsInfoPanelState> {
  private readonly heading: Text;
  private readonly status: Text;
  private readonly reloadButton: Button;

  constructor(private readonly options: DevToolsInfoPanelOptions) {
    super(options.labels.panel, options.labels.scroll);

    this.heading = new Text(options.labels.title, {
      font: options.theme.fontLabel,
      color: options.theme.textMuted,
      maxWidth: 1,
    });
    this.status = new Text(options.labels.availability[options.state.availability], {
      font: options.theme.fontUi,
      color: options.theme.text,
      maxWidth: 1,
    });
    this.reloadButton = new Button(options.labels.reload, {
      width: 1,
      height: 40,
      bg: options.theme.accent,
      hoverBg: options.theme.accentHover,
      color: options.theme.text,
      font: options.theme.fontUi,
      radius: options.theme.radius,
      focusColor: options.theme.focusRing,
      onClick: options.onReload,
    });
    this.content.add(this.heading);
    this.content.add(this.status);
    this.content.add(this.reloadButton);

    this.setState(options.state);
    this.relayoutContent();
  }

  override setState(state: Readonly<DevToolsInfoPanelState>): void {
    this.status.setText(this.options.labels.availability[state.availability]);
    this.reloadButton.disabled = !state.canReload;
    this.relayoutContent();
  }

  protected override layoutContent(contentWidth: number): void {
    this.heading.setMaxWidth(contentWidth);
    this.status.setMaxWidth(contentWidth);
    this.reloadButton.width = contentWidth;
  }

  protected override onForcedColorsChange(forced: boolean): void {
    const { theme } = this.options;
    this.heading.color = forced ? 'CanvasText' : theme.textMuted;
    this.status.color = forced ? 'CanvasText' : theme.text;
  }
}
