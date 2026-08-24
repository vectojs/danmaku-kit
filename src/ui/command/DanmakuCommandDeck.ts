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

/**
 * Identifiers of the seven controls the deck lays out, in their historical
 * left-to-right desktop order. `elapsed` is the non-interactive time label;
 * it rides with whatever cluster names it.
 */
export const COMMAND_DECK_CONTROL_IDS = [
  'input',
  'send',
  'play',
  'timeline',
  'elapsed',
  'rate',
  'lab',
] as const;

export type CommandDeckGroupId = (typeof COMMAND_DECK_CONTROL_IDS)[number];

function validateGroups(groups: readonly CommandDeckGroupId[][]): void {
  if (groups.length === 0) {
    throw new Error('DanmakuCommandDeck groups must contain at least one cluster');
  }
  const seen = new Set<CommandDeckGroupId>();
  for (const cluster of groups) {
    if (cluster.length === 0) {
      throw new Error('DanmakuCommandDeck group clusters must name at least one control');
    }
    for (const id of cluster) {
      if (!(COMMAND_DECK_CONTROL_IDS as readonly string[]).includes(id)) {
        throw new Error(`DanmakuCommandDeck groups name unknown control "${id}"`);
      }
      if (seen.has(id)) {
        throw new Error(`DanmakuCommandDeck control "${id}" appears in more than one cluster`);
      }
      seen.add(id);
    }
  }
  for (const id of COMMAND_DECK_CONTROL_IDS) {
    if (!seen.has(id)) {
      throw new Error(`DanmakuCommandDeck groups omit required control "${id}"`);
    }
  }
}

export interface DanmakuCommandDeckOptions {
  width: number;
  labels: DanmakuKitLabels;
  theme: DanmakuKitTheme;
  callbacks: CommandDeckCallbacks;
  compact?: boolean;
  labOpen?: boolean;
  /**
   * Semantic clusters laid out left-to-right on the desktop row, for example
   * `[["input", "send"], ["play", "timeline", "elapsed"], ["rate", "lab"]]`
   * for compose / transport / utility grouping. Every control id must appear
   * exactly once across the clusters; anything else throws at construction.
   *
   * Gaps inside a cluster keep the ordinary {@link GAP}; boundaries between
   * clusters widen to `groupGap`, which is how an app expresses rhythm -
   * compose | transport | utility reading as three plates instead of one
   * loose spread.
   *
   * The compact layout keeps its proven two-row shape regardless of grouping:
   * those rows are width-starved by design, so clusters collapse into plain
   * rows rather than risk unusable control widths. This is the deliberate
   * degradation, not an omission.
   */
  groups?: readonly CommandDeckGroupId[][];
  /**
   * Gap painted BETWEEN declared clusters on the desktop row. Clamped to at
   * least the intra-cluster gap so a cluster never reads tighter than its own
   * contents. Ignored without `groups`; leaving both unset renders exactly
   * the historical uniform-gap row, byte for byte.
   */
  groupGap?: number;
}

/**
 * One already-downloaded span of the media timeline, in seconds.
 *
 * Mirrors one entry of an `HTMLMediaElement.buffered` `TimeRanges`. A stream
 * seeked around in produces several disjoint ranges, so this is a list rather
 * than a single high-water mark.
 */
export interface DanmakuBufferedRange {
  start: number;
  end: number;
}

export interface DanmakuPlaybackState {
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  disabled: boolean;
  /**
   * Downloaded spans, painted under the scrubber progress. Omit when the source
   * has no buffering notion (a stress-mode run, an image background); the
   * scrubber then shows position only, exactly as before.
   */
  buffered?: readonly DanmakuBufferedRange[];
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

/** Historical default of {@link DanmakuKitTheme.controlHeight} and offset scale reference. */
const DEFAULT_ROW_HEIGHT = 40;
/** Lowest usable control height; below it the slider track and handle stop reading. */
const MIN_CONTROL_HEIGHT = 24;
/**
 * Vertical offset of the elapsed label inside its row, measured at the
 * default 40px row and scaled proportionally so the label stays optically
 * centered at other {@link DanmakuKitTheme.controlHeight} values.
 */
const ELAPSED_ROW_OFFSET_PX = 10;
/**
 * Breathing room above/between/below the compact card's two stacked rows.
 * Derived constants reproduce the historical geometry exactly:
 * commentY = PADDING + row + gap = 57 and COMPACT = commentY + row + gap = 106
 * at the default 40px row.
 */
const COMPACT_ROW_GAP_PX = 9;
const PADDING = 8;
const GAP = 8;
const RATE_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
] as const;
const RATE_LABELS = RATE_OPTIONS.map((option) => option.label);

/** Track thickness and handle radius the library's `Slider` paints with. */
const SLIDER_TRACK_THICKNESS_PX = 6;
const SLIDER_HANDLE_RADIUS_PX = 8;

/**
 * Breathing room added on top of the measured elapsed-label width. The Text
 * entity paints its real glyph width, not the reserved box, so the box has to
 * clear the digits or they reach into the rate dropdown beside them.
 */
const ELAPSED_MARGIN_PX = 4;
/** Narrowest scrubber a compact row keeps before the elapsed label hides. */
const MIN_COMPACT_SCRUBBER_WIDTH = 48;

/**
 * Seek slider that paints downloaded spans under the progress fill.
 *
 * `render` is a full reimplementation rather than a `super.render()` call
 * because paint order is the whole point: buffered has to land above the empty
 * track and below the progress fill, and there is no seam in the library's
 * `render` to inject into. The library's own colors are private, so the ones
 * passed at construction are kept here too. Consequence to accept: a change to
 * the library slider's appearance will not reach this subclass on its own.
 */
class PlaybackSlider extends Slider {
  private playbackDisabled = false;
  private bufferedRanges: readonly DanmakuBufferedRange[] = [];
  /** Painted geometry of {@link bufferedRanges}, used to skip no-op repaints. */
  private bufferedSignature = '';
  private readonly trackFill: string;
  private readonly progressFill: string;
  private readonly handleFill: string;
  private readonly bufferedFill: string;

  public constructor(props: {
    trackColor: string;
    progressColor: string;
    handleColor: string;
    bufferedColor: string;
    [key: string]: unknown;
  }) {
    super(props);
    this.trackFill = props.trackColor;
    this.progressFill = props.progressColor;
    this.handleFill = props.handleColor;
    this.bufferedFill = props.bufferedColor;
  }

  public setDisabled(disabled: boolean): void {
    if (this.playbackDisabled === disabled) return;
    this.playbackDisabled = disabled;
    this.interactive = !disabled;
    this.scene?.markDirty({ entity: this.id, reason: 'playback-disabled' });
  }

  /**
   * Replace the downloaded spans.
   *
   * Called on a poll while a stream downloads, so it must be cheap and must not
   * mark the scene dirty unless the painted result actually moves — otherwise it
   * defeats render-on-demand for the whole app. Ranges are clamped, sorted and
   * merged: overlapping spans of a translucent fill would composite into a
   * visibly darker band that means nothing.
   */
  public setBuffered(ranges: readonly DanmakuBufferedRange[]): void {
    const span = this.max - this.min;
    const merged: DanmakuBufferedRange[] = [];
    for (const range of ranges) {
      if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) continue;
      const start = Math.max(this.min, Math.min(this.max, range.start));
      const end = Math.max(this.min, Math.min(this.max, range.end));
      if (end <= start) continue;
      merged.push({ start, end });
    }
    merged.sort((a, b) => a.start - b.start);
    const normalized: DanmakuBufferedRange[] = [];
    for (const range of merged) {
      const previous = normalized[normalized.length - 1];
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
        continue;
      }
      normalized.push(range);
    }

    // Compare what would be painted, not the raw seconds: a stream advances its
    // buffer continuously, and only a change of at least a pixel is visible.
    const signature =
      span > 0
        ? normalized
            .map((range) => {
              const x0 = Math.round(((range.start - this.min) / span) * this.width);
              const x1 = Math.round(((range.end - this.min) / span) * this.width);
              return `${x0}-${x1}`;
            })
            .join(',')
        : '';
    this.bufferedRanges = normalized;
    if (signature === this.bufferedSignature) return;
    this.bufferedSignature = signature;
    this.scene?.markDirty({ entity: this.id, reason: 'playback-buffered' });
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
    const forced = this.scene?.forcedColors ?? false;
    const span = this.max - this.min;
    const progress = span > 0 ? (this.value - this.min) / span : 0;
    const centerY = this.height / 2;
    const top = centerY - SLIDER_TRACK_THICKNESS_PX / 2;
    const radius = SLIDER_TRACK_THICKNESS_PX / 2;

    renderer.beginPath();
    renderer.roundRect(0, top, this.width, SLIDER_TRACK_THICKNESS_PX, radius);
    renderer.fill(forced ? 'Canvas' : this.trackFill);
    if (forced) renderer.stroke('CanvasText', 1);

    for (const range of span > 0 ? this.bufferedRanges : []) {
      const x0 = ((range.start - this.min) / span) * this.width;
      const x1 = ((range.end - this.min) / span) * this.width;
      renderer.beginPath();
      renderer.roundRect(x0, top, x1 - x0, SLIDER_TRACK_THICKNESS_PX, radius);
      renderer.fill(forced ? 'GrayText' : this.bufferedFill);
    }

    renderer.beginPath();
    renderer.roundRect(0, top, this.width * progress, SLIDER_TRACK_THICKNESS_PX, radius);
    renderer.fill(forced ? 'Highlight' : this.progressFill);

    renderer.beginPath();
    renderer.arc(this.width * progress, centerY, SLIDER_HANDLE_RADIUS_PX, 0, Math.PI * 2);
    if (forced) {
      renderer.fill(this.playbackDisabled ? 'GrayText' : 'ButtonText');
    } else {
      renderer.fill(this.handleFill);
    }

    if (this.focused) {
      renderer.beginPath();
      renderer.arc(this.width * progress, centerY, SLIDER_HANDLE_RADIUS_PX + 3, 0, Math.PI * 2);
      renderer.stroke(forced ? 'Highlight' : this.focusColor, 2);
    }
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
    const mutable = this as unknown as {
      selectedValue: string;
      button: Button;
    };
    mutable.selectedValue = value;
    mutable.button.label = value;
    mutable.button.textWidth = measureText(value, mutable.button.font);
    this.scene?.markDirty({ entity: this.id, reason: 'rate-synced' });
  }

  public override getA11yAttributes() {
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
  private readonly groups: readonly (readonly CommandDeckGroupId[])[] | null;
  private readonly groupGap: number;
  private compact: boolean;
  private labOpen: boolean;

  public constructor(options: DanmakuCommandDeckOptions) {
    super('danmaku-command-deck');
    this.labels = options.labels;
    this.theme = options.theme;
    this.callbacks = options.callbacks;
    this.compact = options.compact ?? false;
    this.labOpen = options.labOpen ?? false;
    if (options.groups !== undefined) validateGroups(options.groups);
    // Structural errors throw; magnitudes clamp. A missing or non-finite
    // number falls back to the historical default instead of poisoning the
    // derived container math with NaN.
    this.groupGap =
      options.groupGap !== undefined && Number.isFinite(options.groupGap)
        ? Math.max(GAP, options.groupGap)
        : GAP;
    this.groups = options.groups ?? null;
    const rowHeight = this.rowHeight();
    this.width = Math.max(0, options.width);
    this.height = this.compact ? this.compactHeight() : this.desktopHeight();
    this.clipChildren = true;

    this.input = new Input({
      width: 160,
      height: rowHeight,
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
      height: rowHeight,
      bg: this.theme.accent,
      hoverBg: this.theme.accentHover,
      color: this.theme.text,
      font: this.theme.fontLabel,
      radius: this.theme.radius,
      focusColor: this.theme.focusRing,
      onClick: () => this.dispatchMessage(),
    });
    this.playButton = new Button(this.labels.command.play, {
      width: 72,
      height: rowHeight,
      bg: this.theme.surfaceRaised,
      hoverBg: this.theme.border,
      color: this.theme.text,
      font: this.theme.fontLabel,
      radius: this.theme.radius,
      focusColor: this.theme.focusRing,
      onClick: () => this.callbacks.onPlayPause(),
    });
    this.timeline = new PlaybackSlider({
      min: 0,
      max: 1,
      value: 0,
      step: 0.1,
      width: 140,
      height: rowHeight,
      label: this.labels.command.videoPosition,
      trackColor: this.theme.border,
      progressColor: this.theme.signal,
      handleColor: this.theme.text,
      bufferedColor: this.theme.bufferedTrack,
      focusColor: this.theme.focusRing,
      onChange: (time: number) => this.callbacks.onSeek(time),
    });
    this.elapsed = new Text('0:00 / 0:00', {
      font: this.theme.fontMono,
      color: this.theme.textMuted,
      selectable: false,
    });
    this.elapsed.height = rowHeight;
    this.rate = new PlaybackRateDropdown(RATE_LABELS, {
      value: RATE_OPTIONS[1].label,
      width: 72,
      height: rowHeight,
      label: this.labels.command.playbackRate,
      bg: this.theme.surfaceRaised,
      color: this.theme.text,
      font: this.theme.fontLabel,
      radius: this.theme.radius,
      // The closed trigger was always themed; without these the menu it opens
      // falls back to the library's navy/cyan defaults.
      menuBg: this.theme.menuSurface,
      menuColor: this.theme.text,
      menuSelectedBg: this.theme.menuSelected,
      menuHighlightBg: this.theme.menuHighlight,
      focusColor: this.theme.focusRing,
      onChange: (label: string) => {
        const option = RATE_OPTIONS.find((candidate) => candidate.label === label);
        if (option) this.callbacks.onRateChange(option.value);
      },
    });
    this.labButton = new Button(
      this.labOpen ? this.labels.command.closeLab : this.labels.command.openLab,
      {
        width: 112,
        height: rowHeight,
        bg: this.theme.surfaceRaised,
        hoverBg: this.theme.border,
        color: this.theme.text,
        font: this.theme.fontLabel,
        radius: this.theme.radius,
        focusColor: this.theme.focusRing,
        onClick: () => {
          this.labOpen = !this.labOpen;
          this.setButtonLabel(
            this.labButton,
            this.labOpen ? this.labels.command.closeLab : this.labels.command.openLab,
          );
          this.scene?.markDirty({ entity: this.id, reason: 'lab-toggled' });
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
    // After min/max, which setBuffered needs to map seconds onto pixels.
    this.timeline.setBuffered(state.buffered ?? []);
    this.setButtonLabel(
      this.playButton,
      state.playing ? this.labels.command.pause : this.labels.command.play,
    );
    const elapsedLabel = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
    if (this.elapsed.text !== elapsedLabel) {
      this.elapsed.setText(elapsedLabel);
      // The reservation tracks the label, so a wider duration format shifts
      // every control right of it.
      this.layoutControls();
    }
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
    this.height = compact ? this.compactHeight() : this.desktopHeight();
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

  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }

  public render(renderer: IRenderer): void {
    const forcedColors = this.scene?.forcedColors ?? false;
    this.elapsed.color = forcedColors ? 'CanvasText' : this.theme.textMuted;
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

  /**
   * One sequential walk over the declared order. Without `groups` the order is
   * the historical flat sequence with GAP at every boundary, so the arithmetic
   * below reproduces the old hand-written positions exactly; with `groups`
   * only the boundary gaps between clusters widen.
   */
  private layoutDesktop(): void {
    const y = PADDING;
    const rowHeight = this.rowHeight();
    const order: readonly CommandDeckGroupId[] = this.groups
      ? this.groups.flat()
      : [...COMMAND_DECK_CONTROL_IDS];
    const clusterOf = new Map<CommandDeckGroupId, number>();
    this.groups?.forEach((cluster, index) => {
      for (const id of cluster) clusterOf.set(id, index);
    });

    this.sendButton.width = 64;
    this.playButton.width = 72;
    this.timeline.width = 140;
    this.rate.width = 72;
    this.labButton.width = 112;
    this.elapsed.a11yHidden = false;
    this.elapsed.opacity = 1;
    this.elapsed.height = rowHeight;
    const widths: Record<CommandDeckGroupId, number> = {
      input: 0, // flexible; resolved last from whatever width remains
      send: this.sendButton.width,
      play: this.playButton.width,
      timeline: this.timeline.width,
      elapsed: this.elapsedReserve(),
      rate: this.rate.width,
      lab: this.labButton.width,
    };

    /** Gap ahead of `order[index]`; 0 ahead of the first control. */
    const boundaryGap = (index: number): number => {
      if (index === 0) return 0;
      const sameCluster = clusterOf.get(order[index - 1]!) === clusterOf.get(order[index]);
      return this.groups && !sameCluster ? this.groupGap : GAP;
    };

    let reserved = 0;
    for (let i = 0; i < order.length; i++) reserved += widths[order[i]!];
    for (let i = 1; i < order.length; i++) reserved += boundaryGap(i);
    this.input.width = Math.max(1, this.width - PADDING * 2 - reserved);

    const entityOf: Record<CommandDeckGroupId, Entity> = {
      input: this.input,
      send: this.sendButton,
      play: this.playButton,
      timeline: this.timeline,
      elapsed: this.elapsed,
      rate: this.rate,
      lab: this.labButton,
    };
    for (const id of order) {
      entityOf[id].width = id === 'input' ? this.input.width : widths[id];
    }
    let x = PADDING;
    for (let i = 0; i < order.length; i++) {
      const id = order[i]!;
      if (i > 0) x += boundaryGap(i);
      entityOf[id].setPosition(x, id === 'elapsed' ? y + this.elapsedOffset() : y);
      x += entityOf[id].width;
    }
  }

  private layoutCompact(): void {
    const playbackY = PADDING;
    const commentY = this.commentY();
    const innerWidth = Math.max(1, this.width - PADDING * 2);
    const playWidth = 64;
    const rateWidth = 64;
    const labWidth = 104;
    // The label paints its measured glyph width, so reserve that plus a
    // margin instead of the old constant 48 that let digits reach into the
    // rate dropdown.
    const elapsedNeeded = this.elapsedReserve();
    // Show the label only while the scrubber still keeps a usable minimum
    // after every fixed control; the old fixed 360px threshold assumed a
    // 48px label.
    const showElapsed =
      innerWidth >=
      playWidth + rateWidth + labWidth + elapsedNeeded + MIN_COMPACT_SCRUBBER_WIDTH + GAP * 4;
    const elapsedWidth = showElapsed ? elapsedNeeded : 0;
    const playbackGaps = showElapsed ? 4 : 3;
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
    this.elapsed.setPosition(
      this.timeline.x + timelineWidth + GAP,
      playbackY + this.elapsedOffset(),
    );
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

  private rowHeight(): number {
    const requested = this.theme.controlHeight;
    return requested !== undefined && Number.isFinite(requested)
      ? Math.max(MIN_CONTROL_HEIGHT, requested)
      : DEFAULT_ROW_HEIGHT;
  }

  private desktopHeight(): number {
    return this.rowHeight() + PADDING * 2;
  }

  private commentY(): number {
    return PADDING + this.rowHeight() + COMPACT_ROW_GAP_PX;
  }

  private compactHeight(): number {
    return this.commentY() + this.rowHeight() + COMPACT_ROW_GAP_PX;
  }

  private elapsedOffset(): number {
    return Math.round((this.rowHeight() / DEFAULT_ROW_HEIGHT) * ELAPSED_ROW_OFFSET_PX);
  }

  private setButtonLabel(button: Button, label: string): void {
    if (button.label === label) return;
    button.label = label;
    button.textWidth = measureText(label, button.font);
  }

  /** Reserved width for the elapsed label: its measured glyphs plus margin. */
  private elapsedReserve(): number {
    return Math.ceil(measureText(this.elapsed.text, this.theme.fontMono)) + ELAPSED_MARGIN_PX;
  }

  private formatTime(time: number): string {
    const wholeSeconds = Math.max(0, Math.floor(time));
    const minutes = Math.floor(wholeSeconds / 60);
    const seconds = wholeSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private boundsOf(entity: Entity): CommandDeckBounds {
    return {
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    };
  }
}
