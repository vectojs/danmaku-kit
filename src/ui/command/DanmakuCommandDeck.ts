import { Entity, type A11yAttributes, type IRenderer, type VectoEvent } from '@vectojs/core';
import { Button, Dropdown, Input, Slider, Text, measureText } from '@vectojs/ui';
import type { DanmakuKitLabels } from '../labels';
import type { DanmakuKitTheme } from '../theme';

export interface CommandDeckCallbacks {
  onSend: (text: string) => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onRateChange: (rate: number) => void;
  onToggleLab: () => void;
}

export interface DanmakuCommandDeckOptions {
  width: number;
  labels: DanmakuKitLabels;
  theme: DanmakuKitTheme;
  callbacks: CommandDeckCallbacks;
  compact?: boolean;
  labOpen?: boolean;
}

export interface DanmakuPlaybackState {
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  disabled: boolean;
}

export interface CommandDeckBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CommandDeckLayoutSnapshot {
  input: CommandDeckBounds;
  send: CommandDeckBounds;
  play: CommandDeckBounds;
  timeline: CommandDeckBounds;
  rate: CommandDeckBounds;
  lab: CommandDeckBounds;
}

const DESKTOP_HEIGHT = 56;
const COMPACT_HEIGHT = 106;
const ROW_HEIGHT = 40;
const PADDING = 8;
const GAP = 8;
const RATE_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
] as const;
const RATE_LABELS = RATE_OPTIONS.map((option) => option.label);

class PlaybackSlider extends Slider {
  private playbackDisabled = false;

  public setDisabled(disabled: boolean): void {
    if (this.playbackDisabled === disabled) return;
    this.playbackDisabled = disabled;
    this.interactive = !disabled;
    this.scene?.markDirty({ entity: this.id, reason: 'playback-disabled' });
  }

  public override getA11yAttributes(): A11yAttributes {
    return {
      ...super.getA11yAttributes(),
      disabled: this.playbackDisabled ? true : undefined,
    };
  }

  public override emit(event: VectoEvent, payload: unknown): void {
    if (
      this.playbackDisabled &&
      (event === 'pointerdown' ||
        event === 'pointermove' ||
        event === 'pointerup' ||
        event === 'keydown' ||
        event === 'change')
    ) {
      return;
    }
    super.emit(event, payload);
  }

  public override render(renderer: IRenderer): void {
    if (!(this.scene?.forcedColors ?? false)) {
      super.render(renderer);
      return;
    }

    const span = this.max - this.min;
    const progress = span > 0 ? (this.value - this.min) / span : 0;
    const centerY = this.height / 2;
    renderer.beginPath();
    renderer.roundRect(0, centerY - 3, this.width, 6, 3);
    renderer.fill('Canvas');
    renderer.stroke('CanvasText', 1);
    renderer.beginPath();
    renderer.roundRect(0, centerY - 3, this.width * progress, 6, 3);
    renderer.fill('Highlight');
    renderer.beginPath();
    renderer.arc(this.width * progress, centerY, 8, 0, Math.PI * 2);
    renderer.fill(this.playbackDisabled ? 'GrayText' : 'ButtonText');
  }
}

class PlaybackRateDropdown extends Dropdown {
  private playbackDisabled = false;

  public setDisabled(disabled: boolean): void {
    if (this.playbackDisabled === disabled) return;
    this.playbackDisabled = disabled;
    this.interactive = !disabled;
    const button = this.children[0];
    if (button instanceof Button) button.disabled = disabled;
    this.scene?.markDirty({ entity: this.id, reason: 'playback-disabled' });
  }

  public setSelectedValue(value: string): void {
    if (this.getValue() === value) return;
    const mutable = this as unknown as { selectedValue: string; button: Button };
    mutable.selectedValue = value;
    mutable.button.label = value;
    mutable.button.textWidth = measureText(value, mutable.button.font);
    this.scene?.markDirty({ entity: this.id, reason: 'rate-synced' });
  }

  public override getA11yAttributes(): A11yAttributes {
    return {
      ...super.getA11yAttributes(),
      disabled: this.playbackDisabled ? true : undefined,
    };
  }

  public override emit(event: VectoEvent, payload: unknown): void {
    if (this.playbackDisabled && (event === 'click' || event === 'keydown' || event === 'change')) {
      return;
    }
    super.emit(event, payload);
  }
}

export class DanmakuCommandDeck extends Entity {
  private readonly labels: DanmakuKitLabels;
  private readonly theme: DanmakuKitTheme;
  private readonly callbacks: CommandDeckCallbacks;
  private readonly input: Input;
  private readonly sendButton: Button;
  private readonly playButton: Button;
  private readonly timeline: PlaybackSlider;
  private readonly elapsed: Text;
  private readonly rate: PlaybackRateDropdown;
  private readonly labButton: Button;
  private compact: boolean;
  private labOpen: boolean;

  public constructor(options: DanmakuCommandDeckOptions) {
    super('danmaku-command-deck');
    this.labels = options.labels;
    this.theme = options.theme;
    this.callbacks = options.callbacks;
    this.compact = options.compact ?? false;
    this.labOpen = options.labOpen ?? false;
    this.width = Math.max(0, options.width);
    this.height = this.compact ? COMPACT_HEIGHT : DESKTOP_HEIGHT;
    this.clipChildren = true;

    this.input = new Input({
      width: 160,
      height: ROW_HEIGHT,
      placeholder: this.labels.command.inputPlaceholder,
      font: this.theme.fontUi,
      color: this.theme.text,
      placeholderColor: this.theme.textMuted,
      bg: this.theme.surfaceRaised,
      border: this.theme.border,
      selectionColor: this.theme.signal,
      radius: this.theme.radius,
    });
    this.input.on('keydown', (event) => {
      const nativeEvent = event.nativeEvent as KeyboardEvent | undefined;
      if (nativeEvent?.key !== 'Enter' || nativeEvent.isComposing) return;
      event.preventDefault?.();
      this.dispatchMessage();
    });

    this.sendButton = new Button(this.labels.command.send, {
      width: 64,
      height: ROW_HEIGHT,
      bg: this.theme.accent,
      hoverBg: this.theme.accentHover,
      color: this.theme.text,
      font: this.theme.fontLabel,
      radius: this.theme.radius,
      onClick: () => this.dispatchMessage(),
    });
    this.playButton = new Button(this.labels.command.play, {
      width: 72,
      height: ROW_HEIGHT,
      bg: this.theme.surfaceRaised,
      hoverBg: this.theme.border,
      color: this.theme.text,
      font: this.theme.fontLabel,
      radius: this.theme.radius,
      onClick: () => this.callbacks.onPlayPause(),
    });
    this.timeline = new PlaybackSlider({
      min: 0,
      max: 1,
      value: 0,
      step: 0.1,
      width: 140,
      height: ROW_HEIGHT,
      label: this.labels.command.videoPosition,
      trackColor: this.theme.border,
      progressColor: this.theme.signal,
      handleColor: this.theme.text,
      onChange: (time: number) => this.callbacks.onSeek(time),
    });
    this.elapsed = new Text('0:00 / 0:00', {
      font: this.theme.fontMono,
      color: this.theme.textMuted,
      selectable: false,
    });
    this.elapsed.height = ROW_HEIGHT;
    this.rate = new PlaybackRateDropdown(RATE_LABELS, {
      value: RATE_OPTIONS[1].label,
      width: 72,
      height: ROW_HEIGHT,
      label: this.labels.command.playbackRate,
      bg: this.theme.surfaceRaised,
      color: this.theme.text,
      font: this.theme.fontLabel,
      radius: this.theme.radius,
      onChange: (label: string) => {
        const option = RATE_OPTIONS.find((candidate) => candidate.label === label);
        if (option) this.callbacks.onRateChange(option.value);
      },
    });
    this.labButton = new Button(
      this.labOpen ? this.labels.command.closeLab : this.labels.command.openLab,
      {
        width: 112,
        height: ROW_HEIGHT,
        bg: this.theme.surfaceRaised,
        hoverBg: this.theme.border,
        color: this.theme.text,
        font: this.theme.fontLabel,
        radius: this.theme.radius,
        onClick: () => {
          this.labOpen = !this.labOpen;
          this.setButtonLabel(
            this.labButton,
            this.labOpen ? this.labels.command.closeLab : this.labels.command.openLab,
          );
          this.callbacks.onToggleLab();
        },
      },
    );

    this.add(
      this.input,
      this.sendButton,
      this.playButton,
      this.timeline,
      this.elapsed,
      this.rate,
      this.labButton,
    );
    this.layoutControls();
  }

  public setPlaybackState(state: Readonly<DanmakuPlaybackState>): this {
    const duration = Number.isFinite(state.duration) ? Math.max(0, state.duration) : 0;
    const currentTime = Number.isFinite(state.currentTime)
      ? Math.max(0, Math.min(duration, state.currentTime))
      : 0;
    const targetRate = Number.isFinite(state.rate) ? state.rate : 1;
    const rateOption = RATE_OPTIONS.reduce((closest, candidate) =>
      Math.abs(candidate.value - targetRate) < Math.abs(closest.value - targetRate)
        ? candidate
        : closest,
    );

    this.timeline.min = 0;
    this.timeline.max = duration > 0 ? duration : 1;
    this.timeline.value = currentTime;
    this.setButtonLabel(
      this.playButton,
      state.playing ? this.labels.command.pause : this.labels.command.play,
    );
    this.elapsed.setText(`${this.formatTime(currentTime)} / ${this.formatTime(duration)}`);
    this.rate.setSelectedValue(rateOption.label);
    this.playButton.disabled = state.disabled;
    this.timeline.setDisabled(state.disabled);
    this.rate.setDisabled(state.disabled);
    this.scene?.markDirty({ entity: this.id, reason: 'playback-state' });
    return this;
  }

  public setCompact(compact: boolean): this {
    if (this.compact === compact) return this;
    this.compact = compact;
    this.height = compact ? COMPACT_HEIGHT : DESKTOP_HEIGHT;
    this.layoutControls();
    this.scene?.markDirty({ entity: this.id, reason: 'command-layout' });
    return this;
  }

  public setWidth(width: number): this {
    const nextWidth = Math.max(0, width);
    if (this.width === nextWidth) return this;
    this.width = nextWidth;
    this.layoutControls();
    this.scene?.markDirty({ entity: this.id, reason: 'command-width' });
    return this;
  }

  public layoutSnapshot(): CommandDeckLayoutSnapshot {
    return {
      input: this.boundsOf(this.input),
      send: this.boundsOf(this.sendButton),
      play: this.boundsOf(this.playButton),
      timeline: this.boundsOf(this.timeline),
      rate: this.boundsOf(this.rate),
      lab: this.boundsOf(this.labButton),
    };
  }

  public render(renderer: IRenderer): void {
    const forcedColors = this.scene?.forcedColors ?? false;
    renderer.beginPath();
    renderer.roundRect(0, 0, this.width, this.height, this.theme.radius);
    renderer.fill(forcedColors ? 'Canvas' : this.theme.surface);
    renderer.stroke(forcedColors ? 'CanvasText' : this.theme.border, 1);
  }

  private dispatchMessage(): void {
    const message = this.input.value.trim();
    if (message.length === 0) return;
    this.callbacks.onSend(message);
    this.input.value = '';
    this.input.selectionStart = 0;
    this.input.selectionEnd = 0;
    this.scene?.markDirty({ entity: this.id, reason: 'message-sent' });
  }

  private layoutControls(): void {
    if (this.compact) {
      this.layoutCompact();
      return;
    }
    this.layoutDesktop();
  }

  private layoutDesktop(): void {
    const y = PADDING;
    this.sendButton.width = 64;
    this.playButton.width = 72;
    this.timeline.width = 140;
    this.rate.width = 72;
    this.labButton.width = 112;
    this.input.setPosition(PADDING, y);
    this.input.width = Math.max(
      1,
      this.width -
        PADDING * 2 -
        this.sendButton.width -
        this.playButton.width -
        this.timeline.width -
        64 -
        this.rate.width -
        this.labButton.width -
        GAP * 6,
    );
    this.sendButton.setPosition(this.input.x + this.input.width + GAP, y);
    this.playButton.setPosition(this.sendButton.x + this.sendButton.width + GAP, y);
    this.timeline.setPosition(this.playButton.x + this.playButton.width + GAP, y);
    this.elapsed.a11yHidden = false;
    this.elapsed.opacity = 1;
    this.elapsed.width = 64;
    this.elapsed.setPosition(this.timeline.x + this.timeline.width + GAP, y + 10);
    this.rate.setPosition(this.elapsed.x + this.elapsed.width + GAP, y);
    this.labButton.setPosition(this.rate.x + this.rate.width + GAP, y);
  }

  private layoutCompact(): void {
    const playbackY = PADDING;
    const commentY = 57;
    const innerWidth = Math.max(1, this.width - PADDING * 2);
    const showElapsed = this.width >= 360;
    const elapsedWidth = showElapsed ? 48 : 0;
    const playbackGaps = showElapsed ? 4 : 3;
    const playWidth = 64;
    const rateWidth = 64;
    const labWidth = 104;
    const timelineWidth = Math.max(
      1,
      innerWidth - playWidth - rateWidth - labWidth - elapsedWidth - playbackGaps * GAP,
    );

    this.playButton.width = playWidth;
    this.playButton.setPosition(PADDING, playbackY);
    this.timeline.width = timelineWidth;
    this.timeline.setPosition(this.playButton.x + playWidth + GAP, playbackY);
    this.elapsed.a11yHidden = !showElapsed;
    this.elapsed.opacity = showElapsed ? 1 : 0;
    this.elapsed.width = elapsedWidth;
    this.elapsed.setPosition(this.timeline.x + timelineWidth + GAP, playbackY + 10);
    this.rate.width = rateWidth;
    this.rate.setPosition(
      showElapsed ? this.elapsed.x + elapsedWidth + GAP : this.timeline.x + timelineWidth + GAP,
      playbackY,
    );
    this.labButton.width = labWidth;
    this.labButton.setPosition(this.rate.x + rateWidth + GAP, playbackY);

    this.sendButton.width = 64;
    this.sendButton.setPosition(this.width - PADDING - this.sendButton.width, commentY);
    this.input.setPosition(PADDING, commentY);
    this.input.width = Math.max(1, this.sendButton.x - GAP - PADDING);
  }

  private setButtonLabel(button: Button, label: string): void {
    if (button.label === label) return;
    button.label = label;
    button.textWidth = measureText(label, button.font);
  }

  private formatTime(time: number): string {
    const wholeSeconds = Math.max(0, Math.floor(time));
    const minutes = Math.floor(wholeSeconds / 60);
    const seconds = wholeSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private boundsOf(entity: Entity): CommandDeckBounds {
    return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
  }
}
