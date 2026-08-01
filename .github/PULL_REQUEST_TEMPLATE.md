<!-- Conventional Commit title, for example: feat(command): add compact playback controls -->

## What and why

<!-- Describe the reusable model/UI problem and link the issue. -->

## Changes

-

## Public API and behavior compatibility

<!-- Describe exports, peer versions, state/callback contracts, and migration impact. -->

## Verification

- [ ] `bun run format:check`
- [ ] `bun run lint`
- [ ] `bun test`
- [ ] `bun run build`
- [ ] `npm pack --dry-run`

## Checklist

- [ ] Added a Changeset for a public package/API/behavior change.
- [ ] Updated `README.md` when behavior or responsibilities changed.
- [ ] Added deterministic model or UI behavior tests.
- [ ] Kept model imports free of VectoJS UI, DOM, storage, and app dependencies.
- [ ] Kept UI theme, labels, state, data, and callbacks injectable.
- [ ] Wrote documentation and non-obvious code comments in English.
