import { describe, expect, it } from 'bun:test';
import type { CharacterEffects } from '@vectojs/danmaku-core';

import { buildProfiledTrack, ProfiledDanmakuTrack, resolveTrackDistribution } from '../src/model';
import type { TrackProfile } from '../src/model';

function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length]!;
}

const PROFILE: TrackProfile = {
  id: 'test-profile',
  label: 'Test profile',
  averagePerSecond: 2,
  peakPerSecond: 3,
  clusterRatio: 0.4,
  maxEntries: 100,
  presetWeights: { scroll: 1, top: 1 },
  effectWeights: { glow: 0.5, gradient: 0.5, rainbow: 0.25, outline: 1 },
};

const EMPTY_RESOLUTION = {
  entries: 0,
  presetCounts: {},
  effectCounts: {},
};

describe('profiled tracks', () => {
  it('is deterministic when random and text sampling are injected', () => {
    const make = () =>
      buildProfiledTrack(15, PROFILE, {
        random: sequence([0.2, 0.8, 0.3, 0.6]),
        sampleText: () => 'same',
      });

    expect(make()).toEqual(make());
  });

  it('returns sorted times bounded by the playable duration', () => {
    const result = buildProfiledTrack(20, PROFILE, {
      random: sequence([0, 0.25, 0.5, 0.75, 1, Number.NaN]),
      sampleText: () => 'bounded',
    });

    expect(result.entries).toHaveLength(40);
    expect(result.entries.every((entry) => entry.time >= 0.1 && entry.time <= 19.9)).toBe(true);
    expect(
      result.entries.every(
        (entry, index, entries) => index === 0 || entries[index - 1]!.time <= entry.time,
      ),
    ).toBe(true);
  });

  it('clamps the resolved count to maxEntries', () => {
    const result = buildProfiledTrack(
      30,
      { ...PROFILE, maxEntries: 7 },
      {
        random: () => 0.5,
        sampleText: () => 'bounded',
      },
    );

    expect(result.entries).toHaveLength(7);
    expect(result.resolved.entries).toBe(7);
  });

  it('rejects empty or entirely invalid preset weights', () => {
    const options = { random: () => 0.5, sampleText: () => 'invalid' };

    expect(() => buildProfiledTrack(2, { ...PROFILE, presetWeights: {} }, options)).toThrow(
      'weighted distribution is empty',
    );
    expect(() =>
      buildProfiledTrack(
        2,
        {
          ...PROFILE,
          presetWeights: {
            scroll: 0,
            top: -1,
            bottom: Number.NaN,
            reverse: Number.POSITIVE_INFINITY,
          },
        },
        options,
      ),
    ).toThrow('weighted distribution is empty');
  });

  it('ignores invalid rows when at least one preset weight is valid', () => {
    const result = buildProfiledTrack(
      1,
      { ...PROFILE, presetWeights: { scroll: 0, top: 1, bottom: Number.NaN } },
      { random: () => 0.5, sampleText: () => 'valid' },
    );

    expect(result.entries.every((entry) => entry.preset === 'top')).toBe(true);
  });

  it('reports exact preset and effect totals from resolved entries', () => {
    const result = buildProfiledTrack(
      2,
      { ...PROFILE, clusterRatio: 0 },
      {
        random: sequence([0.5, 0.25, 0.1, 0.6, 0.1, 0.9, 0.5, 0.75, 0.9, 0.1, 0.3, 0.2]),
        sampleText: () => 'exact',
      },
    );

    expect(result.resolved).toEqual({
      entries: 4,
      presetCounts: { scroll: 2, top: 2 },
      effectCounts: { glow: 2, rainbow: 2, outline: 4, gradient: 2 },
    });
    expect(resolveTrackDistribution(result.entries)).toEqual(result.resolved);
  });

  it('returns an empty resolution at invalid and minimum duration boundaries', () => {
    for (const duration of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 0.2]) {
      expect(buildProfiledTrack(duration, PROFILE, { sampleText: () => 'unused' })).toEqual({
        entries: [],
        resolved: EMPTY_RESOLUTION,
      });
    }

    const justAboveBoundary = buildProfiledTrack(
      0.200_001,
      { ...PROFILE, averagePerSecond: 10 },
      { random: () => 0.5, sampleText: () => 'boundary' },
    );
    expect(justAboveBoundary.entries).toHaveLength(2);
    expect(
      justAboveBoundary.entries.every((entry) => entry.time >= 0.1 && entry.time <= 0.100_001),
    ).toBe(true);
  });

  it('preserves resolved effects through the typed track cursor', () => {
    const effects: CharacterEffects = {
      glow: true,
      gradient: false,
      rainbow: false,
      outline: true,
    };
    const track = new ProfiledDanmakuTrack([
      { time: 0.5, text: 'styled', preset: 'scroll', effects },
    ]);

    expect(track.length).toBe(1);
    expect(track.getTimes()).toEqual([0.5]);
    expect(track.sync(0.5)).toEqual([{ time: 0.5, text: 'styled', preset: 'scroll', effects }]);
    track.reset();
    expect(track.sync(0.5)).toHaveLength(1);
    track.seek(1);
    expect(track.sync(1)).toEqual([]);
  });
});
