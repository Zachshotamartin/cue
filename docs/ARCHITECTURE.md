# Architecture

## Execution boundaries

- `apps/extension`: MV3 service worker, side panel, offscreen recorder and persisted capture data. Uses the selected browser tab and its existing authentication.
- `apps/editor`: Next.js app, React editing UI and HTTP API. Bound to loopback; a same-site owner cookie protects reads and writes. Mutation origins and Host are checked. The extension has separate project-scoped tokens.
- `apps/worker`: persistent job consumer with leases and heartbeat. Provider submissions, polling, downloads, narration and render work survive editor closure.
- `packages/contracts`: Zod contracts; models emit validated data, never rendering code.
- `packages/director`: bounded, deduplicated evidence selection; starter treatments; planner schema and evidence validation.
- `packages/storage`: SQLite WAL transactions, asset validation, encryption and auth.
- `packages/compositor`: the same React scene components power the player and final exports.
- `packages/providers`: explicit Runway, Gemini and ElevenLabs wire contracts. HTTP errors are sanitized. Credentials are server-only.

## State and failure handling

Project edits require the expected revision and create immutable history. Assets are immutable, project-scoped and hashed. A generated take records its originating job, source hash, prompt and model. Source changes invalidate a selected take; caption-only edits do not regenerate it.

A job and budget reservation are created in one immediate transaction. Repeated identical idempotency keys return the original job; conflicting payloads are rejected. A worker marks a request submitting before contacting a provider, persists a returned task ID, then polls. An interrupted submission with no task ID stops as unknown. Retrieval retries preserve the provider ID, and take insertion is deduplicated by originating job.

Render jobs freeze the saved draft. They use owned assets with narrow signatures, self-hosted font assets, a single render worker, an output limiter and FFprobe validation. Browser and export share layout, framing, captions and timing. Separate landscape/portrait/square layouts preserve image aspect ratios; focal cropping is explicit.

## Private prototype decisions

The application uses one package manifest and lockfile with clear package directories rather than publishing workspace packages prematurely. The side panel uses small native modules, without a second React build. Only SiteDNA's readiness evaluator is vendored; route/capture/video logic is Cue code with pinned upstream provenance.

Gemini produces a reviewable description and evidence-linked storyboard in one bounded structured call. Three deterministic treatments provide cheap editable animatics without purchasing three films. A user can exclude private or irrelevant captures before planning.

## Boundaries for the hosted version

Public accounts and billing are deliberately absent. The current loopback cookie is an installation credential, not multi-user authentication. Before hosting: authenticated owners, PostgreSQL migrations/locking tests, private object storage, managed envelope encryption, tenant-aware authorization on every asset/job, account-specific audit events, key rotation, quotas and mandatory BYOK. Never place this local server directly on the Internet.

Deferred creative features: arbitrary screen tracking/occlusion in generated footage, automatic recording redaction, word-aligned subtitles, collaboration and a general multitrack timeline. Uploaded music is user-supplied; no stock track licenses are implied.
