export interface DanmakuKitLabels {
  product: string;
  status: {
    video: string;
    stress: string;
    loading: string;
    paused: string;
    error: string;
    activeSummary: (active: number, capacity: number) => string;
    fpsSummary: (fps: number) => string;
  };
  command: {
    inputPlaceholder: string;
    send: string;
    play: string;
    pause: string;
    videoPosition: string;
    playbackRate: string;
    openLab: string;
    closeLab: string;
  };
  lab: {
    title: string;
    close: string;
    videos: string;
    throughput: string;
    interactions: string;
    devtools: string;
  };
}

export const DEFAULT_DANMAKU_KIT_LABELS: Readonly<DanmakuKitLabels> = Object.freeze({
  product: 'Danmaku',
  status: {
    video: 'Video',
    stress: 'Stress',
    loading: 'Loading',
    paused: 'Paused',
    error: 'Error',
    activeSummary: (active: number, capacity: number) =>
      `${active.toLocaleString()} of ${capacity.toLocaleString()}`,
    fpsSummary: (fps: number) => `${fps.toFixed(1)} frames per second`,
  },
  command: {
    inputPlaceholder: 'Send a danmaku',
    send: 'Send',
    play: 'Play',
    pause: 'Pause',
    videoPosition: 'Video position',
    playbackRate: 'Playback rate',
    openLab: 'Open laboratory',
    closeLab: 'Close laboratory',
  },
  lab: {
    title: 'Danmaku lab',
    close: 'Close',
    videos: 'Videos',
    throughput: 'Throughput',
    interactions: 'Interactions',
    devtools: 'DevTools',
  },
});
