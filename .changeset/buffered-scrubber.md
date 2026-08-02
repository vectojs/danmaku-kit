---
"@vectojs/danmaku-kit": minor
---

Show buffer-ahead on the playback scrubber.

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
