# Changelog

Experimental API. Breaking changes are possible before 1.0.

## Unreleased

- Normalize EventSub timestamps to the host clock using session welcome, preserving stale/future rejection when host and provider clocks differ. Added regression tests for offsets in both directions. Verified real OAuth, route, supply and cooperative goal through a complete one-participant game run.

## 0.2.0 — 2026-10-31

- **Breaking:** constructor accepts a `(chat, window) => Input | undefined` normalizer instead of a raw-chat callback. Attach `AdapterHost` with `start(host)` before OAuth authorization.
- Implements the core `InputAdapter` interface; normalized actions are submitted to the shared trusted core.
- Public `stop()` detaches the host as well as clearing authorization. Planned reconnect and token refresh preserve the attached host.
- Added distribution allowlist, package README, changelog and MIT license.

## 0.1.0 — 2026-10-30

- Initial single-channel installed OAuth/EventSub adapter with bounded delivery suppression, token validation/refresh, reconnect and revocation handling.
