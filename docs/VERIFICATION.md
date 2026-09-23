# Production upgrade verification — September 23, 2026

Current implementation: 40 automated checks pass (account isolation, verified-key requirements, persistence/revisions, concurrent saves and claims, spending/idempotency, credential encryption, upload integrity, provider HTTP contracts, job recovery and recording storage). These use an isolated database adapter and mocked managed-auth sessions; they are not a claim of a live Neon authentication test.

A separate PostgreSQL 14 instance also passed the real SQL migration, concurrent revision, ownership, budget/idempotency, exclusive claim, rate-limit and snapshot checks. The provisioned private Vercel Blob store passed authenticated write/read; anonymous reads returned 403. The synthetic object was removed after verification. TypeScript and the optimized Next.js + Workflow build pass. Production dependency audit: zero known vulnerabilities after pinning patched transitive packages. Vercel project and private Blob store have been created. Encryption, session-signing, worker-signing, cron and Blob secrets are configured as sensitive production env values.

**Outstanding external gate:** Vercel requires the account holder to accept Neon's marketplace terms before the database and managed authentication can be provisioned. Consequently live sign-up/email delivery, cross-browser cloud persistence, local-project import, deployed Workflow/Sandbox rendering and real paid provider execution have not yet been verified. Runway/Gemini/ElevenLabs keys are supplied by each user after sign-in. The Chrome authenticated capture test is postponed at the user's request.

The historical evidence below is from the original local prototype and does not certify the account-based cloud release.

---

# Verification — 23 September 2026

Cue is implemented as a private local application. This report separates completed checks from external integrations that still need a live account or browser permission.

## Completed

- `npm run check`: TypeScript passes; **34 tests in four files pass**; the Chrome extension packages successfully; the optimized Next.js production build succeeds.
- `npm run test:e2e` against the production-mode server and real worker: landscape **1920 × 1080** and portrait **1080 × 1920** H.264 MP4 exports, with AAC audio, pass FFprobe resolution/duration checks. Each test film is two seconds; the muxed file duration is 2.048 seconds including audio padding.
- The same live test verifies scene captions, ZIP download, project manifest/takes, and exclusion of the installation session credential from the manifest.
- Actual rendered frames were inspected. The export now loads its bundled Manrope font before rendering; the earlier cross-origin font failure was corrected. The fresh production render log has no font/CORS error.
- In-app browser: create a film; upload screenshots through the file chooser; construct a starter cut; edit names/captions/brief; save; play the timeline; navigate to Settings with unsaved changes and return with edits preserved; queue and receive a real export; verify capture-dialog focus wrapping and Escape dismissal.
- Responsive browser checks: desktop and 390 × 844 mobile editor/landing views, with no horizontal document overflow. The mobile editor places the inspector below the player and makes the scene list horizontally scrollable.
- Provider controls report missing keys and disable unavailable operations. No paid provider request was sent during verification.

## Automated coverage

The suite exercises owner/origin/Host checks, project-scoped pairing, encrypted credential isolation, immutable revisions and stale-edit conflicts, asset ownership, media sniffing and normalization (including MediaRecorder WebM without a duration), ranged downloads, checksummed chunk upload/retry, budget transactions, idempotency conflicts, recording persistence/recovery, structured plan validation, and provider wire contracts.

Worker tests cover saved-task recovery without resubmission, ambiguous submit handling, retrieval retry with the same task ID, cancellation accounting, and recovery of an already-persisted director response. These provider responses are simulated; they do not prove live generation quality.

## Artifacts

- `docs/screenshots/verified-landscape.mp4` and `.png`
- `docs/screenshots/verified-portrait.mp4` and `.png`
- `docs/screenshots/editor-desktop.png`
- `docs/screenshots/editor-mobile.png`
- `docs/screenshots/landing-mobile.png`
- `examples/cue-first-screening.mp4` and `.png`: 14-second local composition and poster
- `examples/cue-home.png` and `examples/cue-guide.png`: real source captures

## Pending release checks

1. **Real Chrome extension:** loading the unpacked extension with debugger/tabCapture access requires the user's confirmation. After loading into an isolated profile, verify authenticated routes, login redirects, screenshot redaction, recording start/stop, cross-origin discard, panel/browser restart recovery, pairing expiry, and upload retry. Unit tests and a packaged extension are not a substitute for this check.
2. **Live providers:** no Runway, Gemini or ElevenLabs keys are configured in this installation and no paid-test budget is approved. Verify a real structured storyboard, one generated video take, narration, cancel/recovery behavior and billing reconciliation before calling these integrations production-verified.
3. **Public hosting:** deliberately not enabled. Add hosted authentication, tenant isolation, managed encryption/storage and mandatory per-user keys before exposing the service outside loopback.

## Current creative scope

Local capture imports, deterministic film editing/compositing, uploaded background music with narration ducking, and MP4/poster/caption/project exports work without AI accounts. Runway generation, Gemini direction and ElevenLabs speech are implemented but need the live checks above. Music and sound-effect _generation_ are not implemented yet.

The current capture UI discovers links visible in the selected tab and captures reviewed routes/states. It is not an unattended exhaustive site crawler. Captures are viewport images; feature framing is edited in the film. Recordings are silent, manually reviewed, and do not inherit screenshot masks.
