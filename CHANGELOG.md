# @vectojs/danmaku-kit

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
