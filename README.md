# @vectojs/danmaku-kit

Reusable track-profile models and canvas-native laboratory UI for VectoJS danmaku applications.

`danmaku-kit` sits above the renderer-agnostic `@vectojs/danmaku-core`. It provides deterministic profile generation and VectoJS control surfaces without owning an application's catalog, renderer, persistence, branding, or state machine.

## Install

```bash
bun add @vectojs/core @vectojs/ui @vectojs/danmaku-core @vectojs/danmaku-kit
```

Peer ranges:

- `@vectojs/core >=1.24.0 <2.0.0`
- `@vectojs/ui >=2.5.0 <3.0.0`
- `@vectojs/danmaku-core >=0.2.0 <1.0.0`

## Deterministic track profiles

Import model-only code from the focused entry point:

```ts
import { buildProfiledTrack, type TrackProfile } from '@vectojs/danmaku-kit/model';

const profile: TrackProfile = {
  id: 'balanced',
  label: 'Balanced',
  averagePerSecond: 5,
  peakPerSecond: 12,
  clusterRatio: 0.45,
  maxEntries: 800,
  presetWeights: { scroll: 8, reverse: 1, top: 1 },
  effectWeights: { glow: 0.15, outline: 0.2 },
};

const comments = ['First', 'Second', 'Third'];
let commentIndex = 0;
const result = buildProfiledTrack(60, profile, {
  sampleText: () => comments[commentIndex++ % comments.length]!,
});

console.log(result.resolved.entries, result.resolved.presetCounts);
```

Inject `random` in tests or deterministic exporters. The result is sorted, bounded by `maxEntries`, and carries the exact resolved preset/effect counts shown by diagnostic UI.

Generic video contracts are also exported from `/model`: `VideoSourceDescriptor`, `VideoSelection`, `VideoLoadState`, `VideoSourceError`, `normalizeCustomVideoUrl`, and `customVideoId`. They carry state and identity only; applications format errors and own native media elements.

## Canvas-native controls

```ts
import {
  DEFAULT_DANMAKU_KIT_LABELS,
  DEFAULT_DANMAKU_KIT_THEME,
  DanmakuCommandDeck,
  DanmakuStatusBar,
} from '@vectojs/danmaku-kit/ui';

const status = new DanmakuStatusBar({
  width: 640,
  product: 'My danmaku app',
  labels: DEFAULT_DANMAKU_KIT_LABELS,
  theme: DEFAULT_DANMAKU_KIT_THEME,
});

const deck = new DanmakuCommandDeck({
  width: 760,
  labels: DEFAULT_DANMAKU_KIT_LABELS,
  theme: DEFAULT_DANMAKU_KIT_THEME,
  callbacks: {
    onSend: (text) => console.log('send', text),
    onPlayPause: () => console.log('toggle playback'),
    onSeek: (time) => console.log('seek', time),
    onRateChange: (rate) => console.log('rate', rate),
    onToggleLab: () => console.log('toggle lab'),
  },
});
```

Call `setStatus`, `setPlaybackState`, `setWidth`, and `setCompact` when app state or available logical CSS pixels change. Components update existing Entities; they do not read `window`, inject HTML/CSS, or rebuild their control tree on resize.

`DanmakuLabDrawer` receives application-owned panel instances and uses the native `@vectojs/ui` `Tabs` semantics. Its bounds are local and placement-agnostic: the host sets its position and passes the exact available width/height. Generic `VideosPanel`, `ThroughputPanel`, `InteractionsPanel`, and `DevToolsInfoPanel` consume injected rows, state, labels, and callbacks.

## Theme, labels, and accessibility

Pass a complete `DanmakuKitTheme` and localized `DanmakuKitLabels` to product surfaces. The defaults are neutral, accessible English values for smoke scenes; they are not product branding.

Controls use VectoJS Input, Button, Slider, Dropdown, Checkbox, RadioGroup, Tabs, and ScrollView behavior. Accessible names are part of their typed options. Forced-colors rendering uses CSS system colors, and a closed Lab Drawer removes its focusable descendants.

## Ownership boundary

| `danmaku-kit` owns | The application owns |
| --- | --- |
| Track-profile contracts and deterministic builder | Concrete profile values and comment content |
| Generic video identity/load/error contracts | Catalog URLs, licensing metadata, media elements, persistence |
| Themeable status, command, drawer, and Lab controls | Brand theme, localized copy, layout placement, state orchestration |
| Typed metrics/distribution inputs | Renderer counters, pool scans, profiler collection |
| Production-safe DevTools information panel | Dynamic `@vectojs/devtools` import and app plugin |

The package never imports an application or `@vectojs/devtools`. The `/model` entry has no VectoJS UI, DOM, storage, or catalog dependency.

## Lifecycle

Mount components through the normal VectoJS Scene graph. Remove components when no longer needed and always call `scene.destroy()` when the host unmounts. Applications own any media, profiler, or external listeners they inject through callbacks and must dispose those resources separately.

## License

MIT
