# Production upgrade verification — September 23, 2026

The application now uses Supabase Auth and PostgreSQL, private Vercel Blob assets, and account-owned encrypted provider credentials. The public source repository is https://github.com/Zachshotamartin/cue. Vercel was deployed manually to https://cue-tau-green.vercel.app.

## Verified for the current implementation

- TypeScript, the optimized Next.js/Workflow build, and **54 automated checks** pass. Auth checks cover CSRF, password validation, email callback redirects, token-free JSON, recovery authentication, throttling and bounded request bodies. Existing checks cover tenant isolation, revisions, uploads, encryption and provider-job recovery.
- A real Supabase database passed migrations, owner isolation, concurrent revision conflicts, job idempotency/budget reservations, exclusive claims, rate limits and saved snapshots. Synthetic verification rows were cleaned up. Database TLS verifies the provider CA and hostname; SSL is enforced server-side.
- Cue tables live in the private cue schema with RLS enabled and no public grants. Anonymous Supabase Data API access to that schema was rejected with PGRST106.
- The private Vercel Blob store passed authenticated write/read and rejected anonymous reads. Production dependency audit reported zero known vulnerabilities after the Supabase migration.
- Vercel upload inputs were audited. Environment files, local databases, test data and provisioning credentials are excluded explicitly by .vercelignore.

## Verified on the deployed application

- Two synthetic Supabase accounts signed in through Cue. Session cookies were HTTP-only, Secure and SameSite=Lax; no auth tokens appeared in JSON.
- A project created on the staged deployment retained its revision and edits through fresh requests on the promoted domain. Anonymous access returned 401, a different account received 404, and cross-origin writes returned 403.
- A synthetic provider key was saved through Settings and encrypted in PostgreSQL. Neither account received the raw value; the second account did not receive its suffix. Removal passed. The key was never sent to a provider.
- Renderer lifecycle checks prevent SDK command inspection from resuming stopped compute and preserve exports even if compute has already ended.
- After a second production deployment, the saved test project and both exported video assets remained accessible.
- The owner created and verified a real account. Three local projects, including the original 14-second film, were imported with media and revision history; rerunning the import skipped all three without duplicates. The two historical verification films were archived, not deleted. The original local data remains intact.
- Real Vercel Workflow/Sandbox exports completed in landscape (1920 × 1080) and portrait (1080 × 1920), with H.264 video and audio. Both two-second films measured 2.048 seconds including audio padding. They were retrieved from private storage and inspected locally. Captions and the project ZIP also passed.

## Remaining release verification

Public signup and password recovery require custom SMTP: Supabase's default sender only serves organization members. Custom confirmation/recovery templates are prepared but cannot be enabled on the free plan until SMTP is configured. Default same-browser PKCE callbacks remain supported.

Real Runway/Gemini/ElevenLabs generation is not certified without user-supplied keys and a live test. The authenticated Chrome capture test remains postponed at the user's request. Original local projects are preserved and have been imported into the verified owner account.

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
