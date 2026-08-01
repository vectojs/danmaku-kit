export type VideoSourceKind = 'cdn' | 'external';

export interface VideoSourceDescriptor {
  id: string;
  title: string;
  source: {
    kind: VideoSourceKind;
    url: string;
  };
}

export type VideoSelection = { kind: 'catalog'; id: string } | { kind: 'custom'; url: string };

export type VideoSourceErrorCode =
  | 'network-error'
  | 'media-error'
  | 'metadata-error'
  | 'playback-rejected';

export class VideoSourceError extends Error {
  constructor(
    readonly code: VideoSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VideoSourceError';
  }
}

export type VideoLoadState =
  | { status: 'idle' }
  | { status: 'loading'; candidateId: string; progress?: number }
  | { status: 'ready'; sourceId: string }
  | { status: 'error'; candidateId?: string; error: VideoSourceError };

export function normalizeCustomVideoUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.searchParams.sort();
  return url.href;
}

/**
 * Derives a stable local namespace with FNV-1a. The result is not
 * authentication, collision resistance, or any other security boundary.
 */
export function customVideoId(value: string): string {
  const normalized = normalizeCustomVideoUrl(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index++) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `custom-${hash.toString(16).padStart(8, '0')}`;
}
