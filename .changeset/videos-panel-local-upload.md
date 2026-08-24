---
"@vectojs/danmaku-kit": minor
---

`VideosPanel` gains an optional local-file upload affordance. Setting
`onUploadFile` renders a labelled button under the custom-URL input that opens
a transient detached `<input type="file">` picker restricted to
`accept="video/*"` and hands the raw `File` straight through: the kit owns the
picking mechanism, not what happens to the bytes, so Object-URL creation and
revocation stay with the consumer. `labels.uploadFile` names the button, with
an English fallback when omitted. Omitting `onUploadFile` leaves the panel
byte-identical to the historical layout. The button is a projected native
control like Choose and Retry, so keyboard activation, the disabled state and
the themed focus ring come from the same projection gate.
