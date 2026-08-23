---
"@vectojs/danmaku-kit": patch
---

Fix DanmakuCommandDeck reserving fixed widths (64px desktop / 48px compact) for the elapsed-time label while the text paints its measured width: the reservation now comes from `measureText` of the current value plus a margin, playback-state updates re-measure so longer duration formats relayout instead of overlapping the rate dropdown, and compact rows hide the elapsed label once the scrubber would drop below a usable minimum instead of using a fixed 360px threshold.
