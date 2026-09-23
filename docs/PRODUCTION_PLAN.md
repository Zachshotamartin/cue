# Cue production implementation plan

Status: implementation in progress. The original local application is not a production release.

## Product contract

Cue is an account-based application for turning a captured website into an editable promotional film. A project, its revisions, source captures, generated takes, narration, exports, provider job IDs and spending ledger belong to a signed-in user. Closing a tab, opening another browser, or restarting a web server must not delete them or restart a paid generation. The browser is an editor, never the authoritative store or the job runner.

## Infrastructure and ownership

- Public source repository: Zachshotamartin/cue. Commit implementation milestones and keep credentials, recordings, local databases and deployment tokens out of Git.
- Vercel project: cue, Zach team, verified account zachsm@alumni.stanford.edu. Deploy manually; no reliance on GitHub Actions minutes.
- Neon Postgres: durable relational data, transactions, ownership and optimistic revision checks. Migrations are versioned, repeatable, and serialized. No production SQLite or local disk database.
- Neon managed authentication: verified account sessions, sign-in/sign-up, email verification and recovery. Never grant an account by visiting a page. Authenticate server-side on every protected request; proxy redirects are convenience only.
- Private Vercel Blob: immutable assets, upload chunks, generated outputs and export artifacts. Access through ownership-checked endpoints or expiring, purpose-scoped capabilities. Blob URLs are never authorization.
- Vercel Workflow: durable orchestration independent of a browser or laptop. Vercel Sandbox: bounded FFmpeg/Chromium rendering and media processing. Job records remain the user-visible source of truth and preserve ambiguous provider submissions for reconciliation.
- Production, preview and local environments must not silently share production credentials or mutable test data. A missing production dependency fails closed.

## Authentication and authorization

1. Provide branded sign-in, create-account, verification, forgot-password and reset-password flows. Preserve a validated relative return path.
2. Use managed auth session validation; cookies use the SDK's secure HTTP-only same-site configuration. Require verified email before key storage or billable work.
3. Every project lookup requires the authenticated user ID. Asset, upload, revision, job, export, pairing and event access resolves through its project owner. Never accept owner IDs from client input.
4. Server-only worker operations resolve the owner from the persisted job. Provider keys never fall back to the application owner's environment keys for another user.
5. Sign-out clears account-scoped local recovery data. Account settings include session revocation. No passwords, raw provider keys or tokens in logs or responses.
6. Mutations enforce origin/CSRF protection. Pairing is single-use, expiring, project-scoped and rate-limited. Capture tokens are hashed at rest and revocable.

## Durable data model

- projects: ID, owner ID, draft JSON, revision, created/updated times, archived time.
- revisions: project/revision unique, immutable draft and label; restore creates a new revision.
- assets: project, immutable private object path, content hash, kind, bytes, validated dimensions/duration and scrubbed metadata.
- jobs: project, immutable request snapshot, idempotency key, request fingerprint, state, lease/claim token, provider task ID, durable workflow ID, progress, error, reserved/charged cost, cancellation and result IDs.
- takes and exports: durable references to outputs and the exact source/revision/job used. A new result never overwrites an earlier take.
- credentials: user/provider unique, AES-256-GCM ciphertext, random nonce, authentication tag, key version, suffix, updated time. User/provider/version are authenticated associated data.
- pairing/capture tokens, resumable uploads/chunks, events, request limits and schema migrations.
- Foreign keys and uniqueness constraints enforce integrity. Row locking serializes revision updates and budget reservations. Production failures never return raw SQL or secret-bearing provider errors.

## Save and recovery behavior

- Debounced autosave with a visible Saving / Saved / Offline / Conflict state. Serialize saves and coalesce edits made during an in-flight save. Save pending edits before generation, render, navigation or changing sources.
- A per-user/project local recovery draft protects edits during a network outage. It supplements cloud persistence; it is not the project store. Offer recovery instead of silently overwriting a newer cloud revision.
- Optimistic concurrency prevents two tabs from overwriting each other. On conflict, keep the unsaved draft and let the user load the newer version or explicitly save their recovered work against it.
- Persist every source, provider task and output before presenting it as saved. Reopening a project loads jobs and results from the server. Polling resumes from server state; disconnecting has no effect on execution.
- Library supports recent projects, rename, archive/restore and deliberate deletion. Downloads include the actual MP4, poster, captions and editable project archive.

## Upload and capture

- Retain the existing explicit route review, masking, navigation checks and authenticated-browser capture; do not send login cookies to Cue.
- Extend pairing to the deployed HTTPS origin with an explicit extension host permission. Local-only origins are not hardcoded production behavior.
- Use resumable bounded chunks in private cloud storage (or authenticated direct Blob uploads), checksums, atomic completion and idempotent import. Validate file signatures, dimensions, duration and quota server-side. Reject executable files and arbitrary provider-fetch URLs.
- Incomplete uploads expire; cleanup never deletes referenced assets or outputs. Avoid local temporary storage as a cross-request dependency.

## Generation and rendering

- Before provider calls, authenticate, validate source ownership, verify that the user's key exists, save edits, freeze the job inputs, reserve the estimated budget and commit the idempotency key.
- Persist the provider task ID immediately. Poll a known task after interruption. Never automatically repeat an uncertain billed submission. Reconciliation requires an explicit user action and explains possible billing.
- Workflow dispatch is recoverable: persist intent first, then start orchestration; a sweeper can redispatch unstarted jobs safely using database claims. Concurrent workflow deliveries cannot submit twice.
- Sandbox rendering uses immutable input manifests and narrowly scoped asset capabilities. It renders the same composition as the editor, uploads results to private storage and commits output references before marking a job complete. Bound runtime, file size, concurrency and output dimensions.
- Cancellation is durable and best-effort for provider costs. Failure releases only unspent reservations. Keep successful outputs even if a later poster or archive step fails.
- No provider secrets in render manifests, browser bundles, Blob objects, logs or public repository. Sandbox worker callbacks use short-lived job-scoped authorization.

## Keys and environment setup

Generate distinct high-entropy application/session/capability/encryption secrets and configure them with Vercel CLI as sensitive environment values. Database and private Blob credentials stay server-side. Store user-supplied Runway, Gemini and ElevenLabs keys encrypted in Postgres, not in plaintext env files or localStorage. Key settings expose only configured status and the last four characters, with replace/delete controls. Application infrastructure secrets are separate from users' provider keys. Document rotation and recovery; losing the encryption key makes stored provider keys unreadable.

## Operational boundaries

- Free/included infrastructure to start; no automatic billing-plan upgrades. Provider generation is user-funded through their own keys and explicit estimates/limits.
- Per-account storage, upload, project and active-job caps; request throttling on auth-adjacent, pairing, uploads and generation endpoints. Do not expose an anonymous render endpoint.
- Health endpoint reveals dependency readiness without secrets. Structured job IDs support diagnosis. Database backups/restore and object retention must be documented honestly for the selected plan.
- No destructive migration or deletion of the original .data directory. Import existing local projects to the verified owner's account through an explicit migration script, preserving IDs, revisions, asset hashes and paid-job state. Do not rerun existing paid jobs during import.

## Implementation milestones

1. Publish reviewed baseline and this plan; create/link Vercel project and provision storage/database/auth.
2. Add async durable data adapter, migrations and strict per-user authorization; remove production local-session shortcut.
3. Add account screens, per-user encrypted key management, project library and autosave/recovery.
4. Move media/uploads and export downloads to private durable storage.
5. Wire durable generation/render workflows, bounded Sandbox compute and crash/retry reconciliation.
6. Configure sensitive env values, run migrations, import local work after identity verification, review source and manually deploy.

## Release acceptance (not the postponed browser-extension capture test)

- Two accounts cannot access each other's projects, asset IDs, jobs, settings, revisions, upload chunks or capture tokens.
- Reload/new tab/new sign-in restores saved projects and generated exports. Concurrent edits cause a recoverable conflict, never silent loss.
- Closing the browser does not cancel a job. Repeated requests with one idempotency key cannot bill twice. Interrupted uncertain submissions stay visible for reconciliation.
- Uploaded and generated assets survive a new deployment. Private assets reject anonymous access and expired capabilities.
- Key ciphertext cannot be decrypted under another user/provider, and raw keys do not appear in client responses or built artifacts.
- Production uses cloud dependencies and durable workers, not the developer's laptop. Missing configuration shows an honest error and does not enable a local fallback.
- Typecheck/build and targeted persistence/authorization/recovery checks pass. Real paid provider execution is reported separately if credentials or budget are unavailable.

## External setup gates

Marketplace terms, account verification and third-party API credentials may require the account holder. Record the exact gate rather than bypassing it or claiming deployment is complete. Continue independent implementation while a gate is pending.
