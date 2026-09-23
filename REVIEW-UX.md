# Website publishing revision · 2026-09-23

Entry: https://knowgrow-creator-studio.onrender.com/app/

This revision moves the existing website video workflow through account connection, local video preview, current account settings, explicit creator consent, upload and status in one workspace. Telegram is not required for this video workflow.

Implemented: account nickname and duration limit; server-provided visibility with no initial selection; interactions off by default and unavailable options disabled; default-off commercial disclosure, brand labels and privacy restrictions; linked consent declarations; metadata/consent invalidation when inputs change; actual granted-scope check before showing Inbox mode; frozen upload payload; browser attempt record saved before submission; separate pending, failed, published and Inbox outcomes; status refresh and duplicate-init protection. Backend rechecks current account identity, constraints and consent, validates OAuth state and cookie request origin. user.info.basic, when granted, is used by the account endpoint to read the profile; video.publish supplies creator settings and Direct Post; video.upload is used only for the explicit Inbox action when granted.

Tests use synthetic accounts and media metadata with all requests intercepted. They are not recordings or publishing evidence. Run `NODE_PATH=/tmp/node_modules node tests/studio.browser.cjs` (Playwright + installed Chrome). Backend validation: `python -m pytest -q`.

## Deployment and acceptance still required

- Deploy the matching backend before this frontend. The new init contract requires request_id, expected_creator, consent=true and video_duration_sec, which are not sent to TikTok. Check any external consumers before deployment.
- Confirm Render workspace via the connector, inspect existing services and configuration, and deploy only the existing services. No infrastructure or credential changes have been made.
- Verify real OAuth, cookie behavior, actual granted scopes, video preview/upload and TikTok result. The cross-site Render origins depend on browser cookie policy; an unsupported cookie session must remain blocked rather than bypass authentication.
- Backend sessions and attempt records remain process-memory state, as with existing sessions. A restart requires reconnecting; a missing attempt record must never be treated as proof that nothing was submitted. Browser session receipts survive refresh in that tab but are not durable cross-device history.
- The six-photo Telegram Sandbox has NOT been migrated. Do not claim that the existing photo review, its server assets, credentials or scheduled jobs now use this website. Migration needs its own creator-owned asset access and authenticated website flow; do not expose the private Sandbox or reuse Telegram identity as TikTok authorization.
- The new recording and resubmission are pending; no new TikTok publish or application submission occurred in this revision.
