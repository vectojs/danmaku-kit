# @vectojs/danmaku-kit

## 0.8.0

### Minor Changes

- 6418681: `VideosPanel` gains an optional local-file upload affordance. Setting
  `onUploadFile` renders a labelled button under the custom-URL input that opens
  a transient detached `<input type="file">` picker restricted to
  `accept="video/*"` and hands the raw `File` straight through: the kit owns the
  picking mechanism, not what happens to the bytes, so Object-URL creation and
  revocation stay with the consumer. `labels.uploadFile` names the button, with
  an English fallback when omitted. Omitting `onUploadFile` leaves the panel
  byte-identical to the historical layout. The button is a projected native
  control like Choose and Retry, so keyboard activation, the disabled state and
  the themed focus ring come from the same projection gate.

## 0.7.0

### Minor Changes

- b04d526: Group the command deck into semantic clusters, and theme the control surfaces
  with two new optional tokens.

  `DanmakuCommandDeck` gains an options-level `groups` partition and `groupGap`
  (#15). `groups` names the seven deck controls as ordered left-to-right clusters,
  for example compose / transport / utility; boundaries between clusters widen to
  `groupGap` (clamped to at least the intra-cluster gap) while gaps inside a
  cluster stay ordinary, which is how an app expresses reading rhythm instead of
  one loose spread. Every control id must appear in exactly one cluster or
  construction throws. Without `groups` — and in compact mode regardless of
  grouping — geometry is byte-identical to the historical row.

  `DanmakuKitTheme` gains two optional fields (#16):

  - `statusDot` paints status pills as a neutral outline with a small colored
    state dot inside instead of stroking pill and bar underline with the state
    color, letting a theme keep success/warning saturated without colored chrome
    everywhere. Forced colors always paint system colors.
  - `controlHeight` derives every command-deck container literal from one row
    height: the desktop bar height, the compact card's two stacked rows, and the
    elapsed label's vertical centering all scale with it. The status bar keeps
    its own two-line geometry on purpose. Omitted fields preserve the historical
    rendering exactly.

## 0.6.1

### Patch Changes

- d67e484: Fix DanmakuCommandDeck reserving fixed widths (64px desktop / 48px compact) for the elapsed-time label while the text paints its measured width: the reservation now comes from `measureText` of the current value plus a margin, playback-state updates re-measure so longer duration formats relayout instead of overlapping the rate dropdown, and compact rows hide the elapsed label once the scrubber would drop below a usable minimum instead of using a fixed 360px threshold.

## 0.6.0

### Minor Changes

- c8c833e: Show buffer-ahead on the playback scrubber.

  `DanmakuPlaybackState` gains an optional `buffered` list of
  `DanmakuBufferedRange` spans, painted under the progress fill so a viewer can
  see how much of a long stream is downloaded and which regions seek instantly.
  Omitting it leaves the scrubber exactly as before.

  `DanmakuKitTheme` gains a required `bufferedTrack` color. A theme built by
  spreading `DEFAULT_DANMAKU_KIT_THEME` needs no change; a full object literal
  must add the field, and the compiler points at it.

  Deliberately not `@vectojs/ui`'s `ProgressBar`: it sets `interactive = false`,
  so under core's projection gate it contributes no accessibility node at all, and
  it has no `label` option. The buffered span is a visual affordance only — the
  status bar already announces buffering state through its `role="status"` live
  region, and putting buffer detail on the slider's `aria-valuetext` would repeat
  it on every arrow-key seek.

## 0.5.0

### Minor Changes

- 0f390ff: Fix unscrollable laboratory panels, and give every group container its own accessible name.

  **Laboratory panels were not scrollable with a mouse.** `LabelledScrollView` and
  `LabPanel` both returned `pointerEvents: 'none'` from `getA11yAttributes()`. But
  `ScrollView` implements scrolling entirely through node events — `on('wheel')`
  plus `on('pointerdown')`/`on('pointermove')` drag-scroll — and those are
  dispatched only from the projected accessibility element. Suppressing pointer
  events on the scrolling element therefore disabled the wheel and the drag,
  leaving the panel scrollable by keyboard but frozen under a mouse. The
  `ScrollView` no longer opts out; the outer panel region keeps
  `pointerEvents: 'none'` deliberately, because it exactly covers its scrolling
  child and would otherwise swallow the wheel before the child saw it.

  **Group containers announced identically.** The four `RadioGroup`s and the
  laboratory `Tabs` fell back to the library defaults `'Radio group'` and
  `'Tab switching panel'`, so a screen-reader user heard four indistinguishable
  groups. Each now passes the same heading string it already draws on canvas —
  video sources, track profiles, quick targets, distribution, motion presets, and
  the laboratory tablist. This requires `@vectojs/ui` 2.8.0, which added the
  `label` option to both components; the peer range already admitted it.

## 0.4.0

### Minor Changes

- 2f51e61: Theme the open dropdown menu and every focus ring.

  The kit already threaded its theme into each closed control (`bg`, `color`,
  `font`, `radius`), but the playback-rate dropdown's **open** menu and every
  focus ring stayed on `@vectojs/ui`'s dark-navy/cyan defaults. On a themed deck
  the menu opened as an off-palette panel with a cyan selection, reading as a
  rendering bug rather than a style, and focus rings never matched the theme.

  `DanmakuKitTheme` gains four fields, wired through every control the kit owns
  (1 dropdown, 3 sliders, 7 buttons):

  - `focusRing` — kept separate from `accent` so a theme can make focus louder
    than its ordinary emphasis color.
  - `menuSurface`, `menuSelected`, `menuHighlight` — the three open-menu row
    states.

  Requires `@vectojs/ui@2.7.0`, which added the underlying props. The existing
  peer range (`>=2.5.0 <3.0.0`) already admits it, so no peer bump is needed; the
  dev dependency moves to `^2.7.0`.

  ### Migration

  `DanmakuKitTheme` is an interface consumers construct, and the four fields are
  required, so a theme written as a full object literal will not typecheck until
  it adds them. Either add the fields, or spread the default and override
  (`{ ...DEFAULT_DANMAKU_KIT_THEME, accent: '…' }`), which needs no change.

  This is a minor rather than a major because the package is pre-1.0 and its only
  consumer is a private app; the compiler points at every site that needs the
  fields.

## 0.3.0

### Minor Changes

- b977d17: Add optional, injected throughput quick-target presets with radio semantics while retaining the bounded custom target slider.

## 0.2.0

### Minor Changes

- b1537ce: Add deterministic track profiles, canonical video-source contracts, and themeable canvas-native status, command, and laboratory UI for VectoJS danmaku applications.
