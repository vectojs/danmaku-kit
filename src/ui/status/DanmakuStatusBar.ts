import {
  Entity,
  type A11yAttributes,
  type DevtoolsDescriptor,
  type IRenderer,
} from '@vectojs/core';
import { measureText } from '@vectojs/ui';
import type { DanmakuKitLabels } from '../labels';
import type { DanmakuKitTheme } from '../theme';

export type DanmakuStatusKind = 'video' | 'stress' | 'loading' | 'paused' | 'error';

export interface DanmakuStatus {
  state: DanmakuStatusKind;
  fps: number;
  active: number;
  capacity: number;
  backend: string;
}

export interface DanmakuStatusBarOptions {
  width: number;
  product: string;
  labels: DanmakuKitLabels;
  theme: DanmakuKitTheme;
  compact?: boolean;
}

const DESKTOP_HEIGHT = 34;
const COMPACT_HEIGHT = 44;
const HORIZONTAL_PADDING = 12;

/**
 * Dot-mode geometry: the status dot's radius and the horizontal room it adds
 * ahead of the label. The dot sits 11px into the pill so a 3px dot leaves a
 * comfortable margin to both the rounded cap and the shifted label.
 */
const STATUS_DOT_RADIUS_PX = 3;
const STATUS_DOT_EXTRA_PX = 10;

export class DanmakuStatusBar extends Entity {
  private readonly product: string;
  private readonly labels: DanmakuKitLabels;
  private readonly theme: DanmakuKitTheme;
  private readonly productTextWidth: number;
  private compact: boolean;
  private state: DanmakuStatusKind = 'loading';
  private fps = 0;
  private active = 0;
  private capacity = 0;
  private backend = '';
  private stateTextWidth = 0;
  private backendTextWidth = 0;

  public constructor(options: DanmakuStatusBarOptions) {
    super('danmaku-status-bar');
    this.product = options.product;
    this.labels = options.labels;
    this.theme = options.theme;
    this.productTextWidth = measureText(this.product, this.theme.fontDisplay);
    this.compact = options.compact ?? false;
    this.width = Math.max(0, options.width);
    this.height = this.compact ? COMPACT_HEIGHT : DESKTOP_HEIGHT;
    this.interactive = true;
    this.stateTextWidth = measureText(this.statusLabel(), this.theme.fontLabel);
  }

  public setStatus(status: Readonly<DanmakuStatus>): this {
    if (
      this.state === status.state &&
      this.fps === status.fps &&
      this.active === status.active &&
      this.capacity === status.capacity &&
      this.backend === status.backend
    ) {
      return this;
    }

    const stateChanged = this.state !== status.state;
    const backendChanged = this.backend !== status.backend;
    this.state = status.state;
    this.fps = status.fps;
    this.active = status.active;
    this.capacity = status.capacity;
    this.backend = status.backend;
    if (stateChanged) this.stateTextWidth = measureText(this.statusLabel(), this.theme.fontLabel);
    if (backendChanged) this.backendTextWidth = measureText(this.backend, this.theme.fontMono);
    this.scene?.markDirty({ entity: this.id, reason: 'status-changed' });
    return this;
  }

  public getStatus(): DanmakuStatus {
    return {
      state: this.state,
      fps: this.fps,
      active: this.active,
      capacity: this.capacity,
      backend: this.backend,
    };
  }

  public setCompact(compact: boolean): this {
    if (this.compact === compact) return this;
    this.compact = compact;
    this.height = compact ? COMPACT_HEIGHT : DESKTOP_HEIGHT;
    this.scene?.markDirty({ entity: this.id, reason: 'status-layout' });
    return this;
  }

  public setWidth(width: number): this {
    const nextWidth = Math.max(0, width);
    if (this.width === nextWidth) return this;
    this.width = nextWidth;
    this.scene?.markDirty({ entity: this.id, reason: 'status-width' });
    return this;
  }

  public getA11yAttributes(): A11yAttributes {
    return {
      role: 'status',
      label: `${this.product}. ${this.statusLabel()}. ${this.labels.status.activeSummary(this.active, this.capacity)}. ${this.labels.status.fpsSummary(this.fps)}. ${this.backend}.`,
      live: 'polite',
      atomic: true,
      relevant: 'text',
      pointerEvents: 'none',
    };
  }

  public override getDevtoolsDescriptor(): DevtoolsDescriptor {
    return {
      kind: 'DanmakuStatusBar',
      groups: [
        {
          label: 'Status',
          fields: [
            { label: 'state', value: this.state, readOnly: true },
            { label: 'backend', value: this.backend, readOnly: true },
            { label: 'compact', value: this.compact, readOnly: true },
          ],
        },
        {
          label: 'Metrics',
          fields: [
            { label: 'active', value: this.active, readOnly: true },
            { label: 'capacity', value: this.capacity, readOnly: true },
            { label: 'fps', value: this.fps, readOnly: true },
          ],
        },
      ],
    };
  }

  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }

  public render(renderer: IRenderer): void {
    const forcedColors = this.scene?.forcedColors ?? false;
    const surface = forcedColors ? 'Canvas' : this.theme.surface;
    const border = forcedColors ? 'CanvasText' : this.theme.border;
    const text = forcedColors ? 'CanvasText' : this.theme.text;
    const mutedText = forcedColors ? 'CanvasText' : this.theme.textMuted;
    const signal = forcedColors ? 'Highlight' : this.stateColor();
    // Dot mode is an ordinary-theme affordance only: forced colors must paint
    // system colors exclusively, and 'Highlight' already carries the state.
    const dotMode = !forcedColors && (this.theme.statusDot ?? false);
    const pillStroke = dotMode ? border : signal;
    const stateLabel = this.statusLabel();
    const pillWidth = this.stateTextWidth + 16 + (dotMode ? STATUS_DOT_EXTRA_PX : 0);

    renderer.beginPath();
    renderer.roundRect(0, 0, this.width, this.height, this.theme.radius);
    renderer.fill(surface);
    renderer.stroke(border, 1);

    renderer.beginPath();
    renderer.roundRect(0, this.height - 2, this.width, 2, 1);
    renderer.fill(pillStroke);

    if (this.compact) {
      renderer.fillText(this.product, HORIZONTAL_PADDING, 16, this.theme.fontDisplay, text);
      const pillX = this.width - HORIZONTAL_PADDING - pillWidth;
      renderer.beginPath();
      renderer.roundRect(pillX, 5, pillWidth, 18, 9);
      renderer.fill(surface);
      renderer.stroke(pillStroke, 1);
      if (dotMode) {
        renderer.beginPath();
        renderer.arc(pillX + 11, 14, STATUS_DOT_RADIUS_PX, 0, Math.PI * 2);
        renderer.fill(signal);
      }
      renderer.fillText(stateLabel, pillX + (dotMode ? 17 : 8), 18, this.theme.fontLabel, text);
      renderer.fillText(
        this.labels.status.activeSummary(this.active, this.capacity),
        HORIZONTAL_PADDING,
        36,
        this.theme.fontMono,
        mutedText,
      );
      if (this.backendTextWidth + HORIZONTAL_PADDING * 2 < this.width * 0.48) {
        renderer.fillText(
          this.backend,
          this.width - HORIZONTAL_PADDING - this.backendTextWidth,
          36,
          this.theme.fontMono,
          mutedText,
        );
      }
      return;
    }

    const stateX = HORIZONTAL_PADDING + this.productTextWidth + 14;
    renderer.fillText(this.product, HORIZONTAL_PADDING, 22, this.theme.fontDisplay, text);
    renderer.beginPath();
    renderer.roundRect(stateX, 7, pillWidth, 20, 10);
    renderer.fill(surface);
    renderer.stroke(pillStroke, 1);
    if (dotMode) {
      renderer.beginPath();
      renderer.arc(stateX + 11, 17, STATUS_DOT_RADIUS_PX, 0, Math.PI * 2);
      renderer.fill(signal);
    }
    renderer.fillText(stateLabel, stateX + (dotMode ? 17 : 8), 21, this.theme.fontLabel, text);

    const metricX = stateX + pillWidth + 16;
    renderer.fillText(
      this.labels.status.fpsSummary(this.fps),
      metricX,
      21,
      this.theme.fontMono,
      mutedText,
    );
    renderer.fillText(
      this.labels.status.activeSummary(this.active, this.capacity),
      metricX + 154,
      21,
      this.theme.fontMono,
      text,
    );
    if (this.backendTextWidth + HORIZONTAL_PADDING < this.width - (metricX + 304)) {
      renderer.fillText(
        this.backend,
        this.width - HORIZONTAL_PADDING - this.backendTextWidth,
        21,
        this.theme.fontMono,
        mutedText,
      );
    }
  }

  private statusLabel(): string {
    switch (this.state) {
      case 'video':
        return this.labels.status.video;
      case 'stress':
        return this.labels.status.stress;
      case 'loading':
        return this.labels.status.loading;
      case 'paused':
        return this.labels.status.paused;
      case 'error':
        return this.labels.status.error;
    }
  }

  private stateColor(): string {
    switch (this.state) {
      case 'video':
        return this.theme.success;
      case 'stress':
        return this.theme.warning;
      case 'loading':
        return this.theme.signal;
      case 'paused':
        return this.theme.textMuted;
      case 'error':
        return this.theme.danger;
    }
  }
}
