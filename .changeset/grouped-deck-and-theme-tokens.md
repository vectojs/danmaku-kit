---
"@vectojs/danmaku-kit": minor
---

Group the command deck into semantic clusters, and theme the control surfaces
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
