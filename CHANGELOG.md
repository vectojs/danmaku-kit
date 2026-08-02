# @vectojs/danmaku-kit

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
