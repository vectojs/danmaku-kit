import { describe, expect, it } from 'bun:test';

import { customVideoId, normalizeCustomVideoUrl, VideoSourceError } from '../src/model';
import type {
  VideoLoadState,
  VideoSelection,
  VideoSourceDescriptor,
  VideoSourceErrorCode,
} from '../src/model';

describe('video source contracts', () => {
  it('keeps catalog and custom selection identities distinct', () => {
    const catalog: VideoSelection = { kind: 'catalog', id: 'custom-f63aa49e' };
    const custom: VideoSelection = {
      kind: 'custom',
      url: 'https://example.test/video.mp4?a=1&b=2',
    };

    expect(catalog.kind).toBe('catalog');
    expect(custom.kind).toBe('custom');
    expect(customVideoId(custom.url)).toBe('custom-f63aa49e');
    expect(catalog).not.toEqual(custom);
  });

  it('normalizes equivalent custom URLs before deriving a stable identity', () => {
    const unnormalized = 'https://EXAMPLE.test:443/video.mp4?b=2&a=1#frame';
    const normalized = 'https://example.test/video.mp4?a=1&b=2';

    expect(normalizeCustomVideoUrl(unnormalized)).toBe(normalized);
    expect(normalizeCustomVideoUrl(normalized)).toBe(normalized);
    expect(customVideoId(unnormalized)).toBe('custom-f63aa49e');
    expect(customVideoId(unnormalized)).toBe(customVideoId(normalized));
  });

  it('rejects empty, relative, and malformed custom URLs at the URL parser boundary', () => {
    for (const value of ['', 'video.mp4', '/video.mp4', '://example.test/video.mp4']) {
      expect(() => normalizeCustomVideoUrl(value)).toThrow(TypeError);
      expect(() => customVideoId(value)).toThrow(TypeError);
    }
  });

  it('represents generic source descriptors without catalog data', () => {
    const descriptor: VideoSourceDescriptor = {
      id: 'sample',
      title: 'Sample',
      source: { kind: 'external', url: 'https://example.test/sample.mp4' },
    };

    expect(descriptor).toEqual({
      id: 'sample',
      title: 'Sample',
      source: { kind: 'external', url: 'https://example.test/sample.mp4' },
    });
  });

  it('carries typed source errors through load-state transitions', () => {
    const states: VideoLoadState[] = [
      { status: 'idle' },
      { status: 'loading', candidateId: 'candidate' },
      { status: 'loading', candidateId: 'candidate', progress: 0.5 },
      { status: 'ready', sourceId: 'candidate' },
      {
        status: 'error',
        error: new VideoSourceError('media-error', 'no candidate identity'),
      },
      {
        status: 'error',
        candidateId: 'candidate',
        error: new VideoSourceError('network-error', 'candidate unavailable'),
      },
    ];

    const failure = states[5]!;
    expect(failure.status).toBe('error');
    if (failure.status !== 'error') throw new Error('expected error state');
    expect(failure.error).toBeInstanceOf(Error);
    expect(failure.error).toBeInstanceOf(VideoSourceError);
    expect(failure.error).toMatchObject({
      name: 'VideoSourceError',
      code: 'network-error',
      message: 'candidate unavailable',
    });
  });

  it('uses the gated source error codes', () => {
    const codes: readonly VideoSourceErrorCode[] = [
      'network-error',
      'media-error',
      'metadata-error',
      'playback-rejected',
    ];

    expect(codes.map((code) => new VideoSourceError(code, code).code)).toEqual(codes);
  });

  it('loads the public model boundary without UI, DOM, or storage globals', async () => {
    const forbiddenImports: string[] = [];
    const entrypoint = new URL('../src/model.ts', import.meta.url).pathname;
    const build = await Bun.build({
      entrypoints: [entrypoint],
      format: 'esm',
      target: 'bun',
      write: false,
      plugins: [
        {
          name: 'model-import-boundary',
          setup(builder) {
            builder.onResolve({ filter: /^@vectojs\/danmaku-core$/ }, ({ path }) => ({
              external: true,
              path,
            }));
            builder.onResolve({ filter: /^@vectojs\/(?:core|ui)$/ }, ({ path }) => {
              forbiddenImports.push(path);
              return { external: true, path };
            });
          },
        },
      ],
    });

    expect(build.success).toBe(true);
    expect(forbiddenImports).toEqual([]);

    // A fresh dynamic import intentionally exercises module initialization with trapped globals.
    const modelUrl = new URL('../src/model.ts?dom-boundary', import.meta.url).href;
    const child = Bun.spawn(
      [
        process.execPath,
        '--eval',
        `for (const name of ['window', 'document', 'localStorage']) {
          Object.defineProperty(globalThis, name, {
            configurable: true,
            get() { throw new Error('forbidden global accessed: ' + name); },
          });
        }
        await import(${JSON.stringify(modelUrl)});`,
      ],
      { stderr: 'pipe', stdout: 'pipe' },
    );
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);

    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
  });
});
