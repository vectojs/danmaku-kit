import { Button, Input, RadioGroup, Text } from '@vectojs/ui';

import type {
  VideoLoadState,
  VideoSelection,
  VideoSourceDescriptor,
  VideoSourceError,
} from '../../model';

import type { DanmakuKitTheme } from '../theme';
import { LabPanel } from './LabPanel';

export interface VideoMetadataRow {
  label: string;
  value: string;
}

export interface VideoCatalogRow extends VideoSourceDescriptor {
  metadata: ReadonlyArray<Readonly<VideoMetadataRow>>;
  attribution: string;
}

export interface VideoProfileRow<ProfileId extends string> {
  id: ProfileId;
  label: string;
  description: string;
}

export interface VideosPanelState<ProfileId extends string> {
  source: VideoSelection;
  profileId: ProfileId;
  loadState: VideoLoadState;
}

export interface VideosPanelLabels {
  panel: string;
  scroll: string;
  videos: string;
  profiles: string;
  profileDetails: string;
  metadata: string;
  attribution: string;
  customUrl: string;
  customSource: string;
  choose: string;
  retry: string;
  loadState: string;
  formatLoadState: (state: Readonly<Exclude<VideoLoadState, { status: 'error' }>>) => string;
  formatLoadError: (error: Readonly<VideoSourceError>, candidateId: string | undefined) => string;
  formatMetadata: (rows: ReadonlyArray<Readonly<VideoMetadataRow>>) => string;
  formatAttribution: (attribution: string) => string;
}

export interface VideosPanelSelection<ProfileId extends string> {
  source: VideoSelection;
  profileId: ProfileId;
}

export interface VideosPanelOptions<ProfileId extends string> {
  theme: Readonly<DanmakuKitTheme>;
  labels: Readonly<VideosPanelLabels>;
  state: Readonly<VideosPanelState<ProfileId>>;
  catalog: ReadonlyArray<Readonly<VideoCatalogRow>>;
  profiles: ReadonlyArray<Readonly<VideoProfileRow<ProfileId>>>;
  onChoose: (selection: Readonly<VideosPanelSelection<ProfileId>>) => void;
  onRetry: () => void;
  onCustomUrlChange?: (url: string) => void;
}

const CUSTOM_SOURCE_VALUE = 'custom';

export class VideosPanel<ProfileId extends string> extends LabPanel<VideosPanelState<ProfileId>> {
  private readonly sourceGroup: RadioGroup;
  private readonly profileGroup: RadioGroup;
  private readonly customUrlInput: Input;
  private readonly profileDetails: Text;
  private readonly metadata: Text;
  private readonly attribution: Text;
  private readonly loadState: Text;
  private readonly chooseButton: Button;
  private readonly retryButton: Button;
  private readonly texts: Text[] = [];

  private pendingSource: VideoSelection;
  private pendingProfileId: ProfileId;

  constructor(private readonly options: VideosPanelOptions<ProfileId>) {
    super(options.labels.panel, options.labels.scroll);
    this.pendingSource = options.state.source;
    this.pendingProfileId = options.state.profileId;

    this.addHeading(options.labels.videos);
    this.sourceGroup = new RadioGroup({
      options: [
        ...options.catalog.map((row, index) => ({
          value: this.catalogValue(index),
          label: row.title,
        })),
        { value: CUSTOM_SOURCE_VALUE, label: options.labels.customSource },
      ],
      value: this.valueForSource(options.state.source),
      direction: 'vertical',
      gap: 10,
      font: options.theme.fontUi,
      color: options.theme.text,
      accent: options.theme.accent,
      border: options.theme.border,
      onChange: (value) => this.selectSource(value),
    });
    this.content.add(this.sourceGroup);

    this.addHeading(options.labels.customUrl);
    this.customUrlInput = new Input({
      width: 1,
      height: 40,
      placeholder: options.labels.customUrl,
      value: options.state.source.kind === 'custom' ? options.state.source.url : '',
      font: options.theme.fontUi,
      color: options.theme.text,
      placeholderColor: options.theme.textMuted,
      bg: options.theme.surfaceRaised,
      border: options.theme.border,
      radius: options.theme.radius,
      onChange: (url) => {
        this.pendingSource = { kind: 'custom', url };
        this.sourceGroup.value = CUSTOM_SOURCE_VALUE;
        this.chooseButton.disabled = url.trim().length === 0;
        options.onCustomUrlChange?.(url);
      },
    });
    this.content.add(this.customUrlInput);

    this.addHeading(options.labels.profiles);
    this.profileGroup = new RadioGroup({
      options: options.profiles.map((row, index) => ({
        value: this.profileValue(index),
        label: row.label,
      })),
      value: this.valueForProfile(options.state.profileId),
      direction: 'vertical',
      gap: 10,
      font: options.theme.fontUi,
      color: options.theme.text,
      accent: options.theme.signal,
      border: options.theme.border,
      onChange: (value) => this.selectProfile(value),
    });
    this.content.add(this.profileGroup);

    this.addHeading(options.labels.profileDetails);
    this.profileDetails = this.addBody('');
    this.addHeading(options.labels.metadata);
    this.metadata = this.addBody('');
    this.addHeading(options.labels.attribution);
    this.attribution = this.addBody('');
    this.addHeading(options.labels.loadState);
    this.loadState = this.addBody('');

    this.chooseButton = new Button(options.labels.choose, {
      width: 1,
      height: 40,
      bg: options.theme.accent,
      hoverBg: options.theme.accentHover,
      color: options.theme.text,
      font: options.theme.fontUi,
      radius: options.theme.radius,
      focusColor: options.theme.focusRing,
      onClick: () =>
        options.onChoose({ source: this.pendingSource, profileId: this.pendingProfileId }),
    });
    this.retryButton = new Button(options.labels.retry, {
      width: 1,
      height: 40,
      bg: options.theme.surfaceRaised,
      hoverBg: options.theme.border,
      color: options.theme.text,
      font: options.theme.fontUi,
      radius: options.theme.radius,
      focusColor: options.theme.focusRing,
      onClick: options.onRetry,
    });
    this.content.add(this.chooseButton);
    this.content.add(this.retryButton);

    this.setState(options.state);
    this.relayoutContent();
  }

  override setState(state: Readonly<VideosPanelState<ProfileId>>): void {
    const source = state.source;
    this.pendingSource = source;
    this.pendingProfileId = state.profileId;
    this.sourceGroup.value = this.valueForSource(source);
    this.profileGroup.value = this.valueForProfile(state.profileId);
    if (source.kind === 'custom') this.customUrlInput.value = source.url;

    const video =
      source.kind === 'catalog'
        ? this.options.catalog.find((row) => row.id === source.id)
        : undefined;
    const profile = this.options.profiles.find((row) => row.id === state.profileId);
    this.profileDetails.setText(profile?.description ?? '');
    this.metadata.setText(this.options.labels.formatMetadata(video?.metadata ?? []));
    this.attribution.setText(this.options.labels.formatAttribution(video?.attribution ?? ''));
    this.loadState.setText(
      state.loadState.status === 'error'
        ? this.options.labels.formatLoadError(state.loadState.error, state.loadState.candidateId)
        : this.options.labels.formatLoadState(state.loadState),
    );
    this.retryButton.disabled = state.loadState.status !== 'error';
    this.chooseButton.disabled = source.kind === 'custom' && source.url.trim().length === 0;
    this.relayoutContent();
  }

  protected override layoutContent(contentWidth: number): void {
    this.customUrlInput.width = contentWidth;
    this.chooseButton.width = contentWidth;
    this.retryButton.width = contentWidth;
    for (const text of this.texts) text.setMaxWidth(contentWidth);
  }

  protected override onForcedColorsChange(forced: boolean): void {
    const { theme } = this.options;
    for (const text of this.texts) text.color = forced ? 'CanvasText' : theme.text;
    this.sourceGroup.color = forced ? 'CanvasText' : theme.text;
    this.sourceGroup.accent = forced ? 'Highlight' : theme.accent;
    this.sourceGroup.border = forced ? 'CanvasText' : theme.border;
    this.profileGroup.color = forced ? 'CanvasText' : theme.text;
    this.profileGroup.accent = forced ? 'Highlight' : theme.signal;
    this.profileGroup.border = forced ? 'CanvasText' : theme.border;
    this.customUrlInput.color = forced ? 'CanvasText' : theme.text;
    this.customUrlInput.placeholderColor = forced ? 'GrayText' : theme.textMuted;
    this.customUrlInput.bg = forced ? 'Canvas' : theme.surfaceRaised;
    this.customUrlInput.border = forced ? 'CanvasText' : theme.border;
  }

  private selectSource(value: string): void {
    if (value === CUSTOM_SOURCE_VALUE) {
      this.pendingSource = { kind: 'custom', url: this.customUrlInput.value };
      this.chooseButton.disabled = this.customUrlInput.value.trim().length === 0;
      this.metadata.setText(this.options.labels.formatMetadata([]));
      this.attribution.setText(this.options.labels.formatAttribution(''));
      this.relayoutContent();
      return;
    }
    const index = Number(value.slice('catalog:'.length));
    const row = this.options.catalog[index];
    if (row) {
      this.pendingSource = { kind: 'catalog', id: row.id };
      this.chooseButton.disabled = false;
      this.metadata.setText(this.options.labels.formatMetadata(row.metadata));
      this.attribution.setText(this.options.labels.formatAttribution(row.attribution));
      this.relayoutContent();
    }
  }

  private selectProfile(value: string): void {
    const index = Number(value.slice('profile:'.length));
    const row = this.options.profiles[index];
    if (row) {
      this.pendingProfileId = row.id;
      this.profileDetails.setText(row.description);
      this.relayoutContent();
    }
  }

  private valueForSource(source: Readonly<VideoSelection>): string {
    if (source.kind === 'custom') return CUSTOM_SOURCE_VALUE;
    const index = this.options.catalog.findIndex((row) => row.id === source.id);
    return this.catalogValue(Math.max(0, index));
  }

  private valueForProfile(profileId: ProfileId): string {
    return this.profileValue(
      Math.max(
        0,
        this.options.profiles.findIndex((row) => row.id === profileId),
      ),
    );
  }

  private catalogValue(index: number): string {
    return `catalog:${index}`;
  }

  private profileValue(index: number): string {
    return `profile:${index}`;
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

  private addBody(value: string): Text {
    const text = new Text(value, {
      font: this.options.theme.fontUi,
      color: this.options.theme.text,
      maxWidth: 1,
      lineHeight: 18,
    });
    this.texts.push(text);
    this.content.add(text);
    return text;
  }
}
