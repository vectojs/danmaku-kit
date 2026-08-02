---
"@vectojs/danmaku-kit": minor
---

Fix unscrollable laboratory panels, and give every group container its own accessible name.

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
