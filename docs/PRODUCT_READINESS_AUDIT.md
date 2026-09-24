# Cue: product quality and production readiness audit

Date: 23 September 2026. Code reviewed: `079c4aa`, branch `feature/cue-brand-alignment`.

This is an assessment and proposed implementation plan, not a claim that the improvements below are implemented. It combines source inspection with the recorded live verification in `VERIFICATION.md`. No additional paid generations, deployments, or training-process changes were made for this audit. Hosted settings such as SMTP were not rechecked in their consoles; outstanding infrastructure items reflect the last recorded verification.

## Outcome Cue must deliver

A user connects their authenticated website, chooses what the film should communicate, and receives an editable promotional video that demonstrates the actual product. Useful interactions, readable UI, convincing outcomes, coherent pacing, sound, and branding should survive the entire capture-to-export process. Projects, original media, generated takes, edits, and exports must remain accessible after closing the browser. Provider keys belong to each account and remain encrypted at rest.

The failed demo was a product-quality failure despite successful API calls. Its two inputs were marketing screenshots. The planner could not inspect recordings, identify a user journey, or select action/result moments. The compositor presented screens with captions and modest camera movement. A generated landing-page animation did not supply the missing demonstration.

## Foundations to retain

- Supabase authentication, API ownership checks, a private PostgreSQL schema, private Blob storage, and account-scoped encrypted provider keys.
- Revision-based autosave, conflict detection, browser recovery, project history, immutable media and saved exports. Reload/new-tab persistence was verified for the provider-test film.
- Job reservations, idempotency, saved provider task IDs, cancellation states and protection against blindly resubmitting ambiguous paid requests.
- Chrome route screenshots, screenshot masks, manual recordings, persisted local recording chunks and resumable uploads. Real authenticated extension operation remains unverified.
- OpenAI, Claude and Gemini planner adapters; Runway generation; ElevenLabs speech; uploaded background audio; shared preview/export compositions.
- Successful real local-worker OpenAI/Runway/ElevenLabs requests and a 23-second combined export. Prior cloud Sandbox rendering checks also passed. These are separate from unverified paid-provider execution through the hosted Workflow path.
- Shared UI primitives, growing textareas, resizable/collapsible sidebars, architecture tests, CI and a documented manual-release procedure.

The latest recorded suite has 92 passing tests plus TypeScript, extension packaging and a production build. That is evidence for the covered behavior, not an overall product-quality score.

## 1. Brief and product understanding — essential

**Current:** The brief holds a description, audience, CTA and one of three treatments. The planner requests 4–7 scenes totaling 20–35 seconds regardless of the product. Project title also becomes the on-screen product name.

**Change:** Separate product identity from the internal film name. Add objective, destination/channel, duration, priority features, primary user journey, CTA URL, narration preference and visual references. Offer a short default flow with advanced controls hidden. Infer a draft brief from captured evidence, then let the user correct it. Support both an interaction-led product demonstration and a marketing/portfolio film where interaction is less important.

**Acceptance:** A film named “September launch v3” still presents the correct product name. A SaaS onboarding demo and a portfolio promotion produce different capture plans and structures. Every featured capability is supported by evidence or explicitly marked as needing capture.

## 2. Authenticated capture and website coverage — essential

**Current:** `inspectTab` discovers links in the current page; it is not a recursive, state-aware crawler. Reviewed routes become viewport screenshots. Users can manually record a tab, but Cue does not plan or record the semantic steps of a workflow.

**Change:** Build a resumable capture session with a map of routes, page types and meaningful states: menu open, item selected, form completed, result visible. Deduplicate repeated detail pages without discarding useful before/after states. Support guided recording first, alongside bounded assisted capture of approved workflows in the user's signed-in tab. Authentication stays in the browser. Show which important screens and outcomes are missing. Allow recapturing one failed state without restarting the session.

SiteDNA's current reuse is only its readiness evaluator. Reuse additional useful inspection ideas deliberately; do not assume Cue already inherits SiteDNA's broader capabilities.

**Acceptance:** An authenticated test app with client-side navigation, a modal, a form and a result screen produces a complete ordered journey. Session expiry, browser restart and failed upload can be recovered. The user can stop capture immediately. Consequential actions such as publishing or purchases are excluded from unattended exploration.

Chrome tab recording must remain visibly user-initiated; that is a platform constraint, not an implementation shortcut. [Chrome tabCapture documentation](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).

## 3. Interaction recording and privacy — essential

**Current:** Recordings are silent, capped at 60 seconds/50 MiB, and lack a timed interaction trail. Screenshot masks do not carry over to recordings.

**Change:** Record timecoded clicks, pointer movement, scroll, focused control bounds, navigation and observable result states. Capture semantic control labels after sanitization; do not collect passwords or raw keystrokes. Add pause/resume, retake, segment markers and a useful review screen. Support adjustable bounded recording duration and optional tab audio. Use masks that track selected elements in recorded frames, with a preview that exposes exactly what will be uploaded and sent to a model. Imported recordings need a separate redaction path. Do not promise automatic detection catches every private detail.

**Acceptance:** A masked account value remains hidden in screenshots, recordings, extracted thumbnails, planner evidence and exports. Event times stay aligned after pauses and trimming. Reload recovery never silently uploads an unfinished/private take.

## 4. Recording analysis and evidence selection — essential

**Current:** `planningImages` filters to images and takes the first six. Videos can be listed as assets without their frames being shown to the planner. Evidence selection mostly uses heading-text presence, media type and warnings. Video scenes initially begin at time zero.

**Change:** Create an analysis stage before storyboarding: extract frames around interactions and visual changes, detect useful segments, identify loading/idle intervals, and associate each result with its preceding action. Combine frames with sanitized page/control evidence. Store timecodes, feature labels, focal regions and confidence. Use bounded sampling and cached analysis keyed by source hash and analyzer version. Rank by relevance and coverage rather than upload order.

**Acceptance:** Given a recording with waiting at the start, Cue selects the meaningful interaction and resulting state. A video-only project can be understood. Replanning unchanged sources reuses analysis. Unsupported inferences remain visible uncertainties rather than invented features.

## 5. Story direction — essential

**Current:** One model call fills a generic scene schema. There is no representation for a workflow, action/result pair, source in/out times, timed emphasis or missing evidence. Proposals are mostly text.

**Change:** Separate evidence analysis, narrative planning and edit planning. A proposed beat should specify the viewer takeaway, supporting source interval, action, visible outcome, caption/narration, focal target, timing and optional generation purpose. Preserve dependencies: the result must follow the action that produced it. Present illustrated storyboard cards with playable source excerpts. Allow “show more of this feature,” “shorten this section” and “replace this scene” without throwing away accepted work.

Add a capture-completeness check. Two marketing screenshots should trigger “We still need a workflow recording,” with an explicit option to make a screenshot-based teaser. Freeze the evidence IDs/hashes at job creation: the current worker reads the asset list when the job executes, after the draft was queued.

**Acceptance:** A viewer can explain what the product does and why it helps. Each claim points to actual evidence. A local storyboard change retains unrelated edits and purchased assets. Missing product footage cannot silently become a claimed feature demonstration.

## 6. Film composition and visual quality — essential

**Current:** The compositor provides framed screens, captions, static focal crops, small push/pan motions and cut/fade behavior. It cannot express an event-driven edit. Successive fades fade each scene independently rather than providing a designed transition between shots.

**Change:** Add a small, shared set of compositing primitives: timed focal moves, click emphasis, highlights, callouts, crop keyframes, context-to-detail moves, result holds, before/after and continuous workflow cuts. Cut idle time; preserve enough context that viewers know what changed. Fit captions and important UI within destination-specific safe areas. Make screen scale and reading time respond to content. Use the actual product's colors, logo and typography where supplied.

**Acceptance:** Important UI remains legible on a phone-sized preview. Pointer/callout timing matches the source action. There are no accidental black flashes, chopped-off labels or repetitive movement on every shot. Compare preview and exported frames at representative timestamps in all supported aspect ratios.

## 7. Generated footage — important, after real demonstrations work

**Current:** Runway animates a selected image. Generated video may replace the actual UI scene. There is no review for interface distortion beyond basic media validity.

**Change:** Give generated footage a defined role: opening/closing atmosphere, backgrounds or selected transitional moments. Keep real captured UI intact for feature demonstrations, optionally composited over a generated background. Propose generation only where it serves the story, show the exact cost/input first, retain alternatives, and permit reverting without regeneration. Screen generated clips for warped text and misleading behavior, with human review for final selection.

**Acceptance:** The core product demo remains convincing with generated footage disabled. No invented click result is presented as actual product behavior. Accepted recordings and existing paid takes survive all edits.

## 8. Voice, music, sound effects and captions — essential to the finished film

**Current:** Speech generation requires manually entering a voice ID. Music is an uploaded loop with volume reduction across entire scenes containing narration. Source recordings are muted. SRT output times scene captions rather than transcribed speech.

**Change:** Add a voice picker with previews, pronunciation controls and script editing across the whole film. Fit narration and edits together. Add instrumental music generation or licensed uploads, restrained event-based SFX, waveform editing, clip fades, actual speech-window ducking, loudness/peak checks and a clear music ending. Support genuine aligned speech captions separately from marketing overlays. Persist provenance and applicable usage information for imported/generated sound.

ElevenLabs has both [music](https://elevenlabs.io/docs/overview/capabilities/music) and [sound-effect](https://elevenlabs.io/docs/overview/capabilities/sound-effects) APIs. Access and rights need to match the user's provider plan; Cue's present integration only implements speech.

**Acceptance:** Speech is intelligible, never cut off, and never masked by music. Click/result cues align with the actual edit. Captions match the chosen speech. The video also communicates clearly when muted.

## 9. Editor and onboarding — essential

**Current:** Most controls exist as individual inspectors. Users must understand assets, takes, modes, provider keys and several separate generation steps before producing a film. Proposals lack visual previews. Crop/trim is primarily numeric.

**Change:** Provide a clear progression: Brief → Capture → Story → Edit & sound → Export. Each stage should state what is ready and the next useful action. Keep detailed editing accessible through the existing reusable inspectors. Add a visual timeline with thumbnail strips, trim handles, split/reorder/duplicate, snapping and audio waveforms; direct canvas framing; scene locks; explicit preview of regeneration scope/cost. Retain growing textareas and persistent, accessible sidebar sizing. Use the `/brand` design system across landing, auth, dashboard, editor, settings, dialogs and errors.

**Acceptance:** A new user produces a first editable draft without documentation or entering a voice ID. Keyboard users can complete the flow. Laptop layouts do not truncate controls. Small screens can review work even if full editing is optimized for desktop. Empty, loading, disconnected, conflict and failure states have specific recovery actions.

## 10. Provider connections and spending — essential

**Current:** Keys are encrypted and account-scoped, but “Connected” means a row is saved, not that the key/model access was verified. Job budgets exist; `chargedCents` generally records reserved estimates rather than reconciled actual invoices. Export infrastructure cost is not represented by the AI-provider budget.

**Change:** Distinguish saved, verified, expired, insufficient-credit and unavailable-model states. Provide bounded connection checks where the provider supports them; do not spend silently to validate a key. Surface estimated versus known usage, reservations, unknown submissions and cancellation limitations. Add account-wide and operator-wide limits, storage/egress/render allowances and alerts. Keep “regenerate this scene” separate from regenerating the whole film. Never fall back to the operator's keys for public users.

**Acceptance:** A failed/ambiguous job has an understandable recovery path and cannot be accidentally purchased twice. Changing captions causes no AI charge. A user understands provider charges and Cue compute limits before starting work.

## 11. Project and media lifecycle — launch requirement

**Current:** Saved projects, revisions, archives and exports exist. There is no user-facing media deletion or permanent project/account deletion path in the inspected routes. The storage-limit error nevertheless asks users to remove media. ZIP export is not a verified restore/import flow.

**Change:** Add searchable projects, duplication for film variants, explicit export versions and safe replacement/recapture of media. Implement deletion with reference checks across revisions, takes and active jobs; explain what space will be reclaimed. Add account deletion, retained-data policy and export/restore verification. Preserve recoverable history without retaining every unwanted large artifact forever. Private expiring review links can follow, with revocation and read-only access distinct from editing.

**Acceptance:** Users can resolve a full-storage condition. Removing an unused take cannot break a saved export or active job. A project restored from its archive opens and renders. Account removal cleans up credentials, paired extension tokens and retained media according to the stated policy.

## 12. Authentication, data isolation and public onboarding — launch blockers

**Current:** Account authentication and ownership isolation have real verification. The last recorded deployment still lacks custom SMTP for general signup/recovery. Local testing currently shares production database, authentication and media storage.

**Change:** Configure production email delivery and verify a new external email account, confirmation, reset, expiry and cross-device recovery. Isolate local, preview/staging and production databases, buckets, keys and queues, with startup guards against accidental production writes. Preserve the existing signed-in session/device controls. Test extension pairing and asset capabilities across accounts and environments. Publish accurate privacy/data-processing documentation, including which selected assets go to which provider. Rehearse encryption-key rotation and restore; retain owner-scoped authenticated encryption.

Supabase explicitly describes its [default email service](https://supabase.com/docs/guides/auth/auth-smtp) as restricted to pre-authorized team addresses and unsuitable for production. Source code for signup alone does not resolve this gate.

**Acceptance:** An unrelated customer can register and recover access. Another account cannot read projects, media, keys or job results. Development jobs cannot claim production work. Deleted/revoked access stops working as expected. No credentials enter browser bundles, archives or diagnostic logs.

## 13. Durable processing and operations — launch requirement

**Current:** Workflow, Sandbox rendering, leases, idempotency and a recovery sweep exist. Real paid jobs were exercised with the local worker, not the hosted Workflow path. Database startup and render-progress contention fixes are on the current branch and not yet deployed. Each Sandbox boot installs dependencies and system packages.

**Change:** Verify hosted planning, video, narration and export while the browser and local worker are closed. Exercise interrupted submissions, provider throttling, delayed results, cancellation, expired media URLs and worker termination. Split new analysis/capture processing into resumable stages. Persist stage artifacts before advancing. Add structured, sanitized diagnostics, dependency-aware readiness, queue age/failure alerts, per-account fair scheduling and global concurrency controls. Measure render startup and cache/prebuild dependencies where supported. Add independent backups and a demonstrated restoration procedure.

**Acceptance:** Closing the tab or laptop does not stop hosted work. Recovery continues the existing paid task rather than purchasing a duplicate. Failures identify the affected stage and preserve completed work. A backed-up project and its media can be restored, not merely listed in a backup dashboard.

## 14. Code structure, migrations and release discipline — essential

**Current:** Package boundaries and shared components are useful foundations. However, `packages/server/api.ts` combines many unrelated routes, and `useEditorController` combines loading, editing, history, saving and jobs with loose types. Documentation mixes historical local architecture and current hosted behavior. CI exists; deployments are manual.

**Change:** Split domain services for captures, evidence, stories, edits, media, credentials and jobs; split the controller into typed, tested stateful hooks. Keep visual primitives and scene renderers defined once and imported by editor and export. Add versioned contracts and explicit database migrations for the richer timeline/evidence formats. Freeze assets, prompt/schema versions and compositor version with each job/export. Keep a single current verification matrix and move outdated architecture to history. Run dependency, secret, type, test, formatting and build checks; preserve manual staged deployment, verification, promotion and rollback with a pinned render commit.

**Acceptance:** A saved old project opens after a release; migration failures preserve data. Local/cloud adapters pass the same domain tests. A release record identifies the source SHA, database migration, renderer SHA and deployment actually live. A merged PR is never reported as a deployed release.

## 15. End-to-end and creative quality evaluation — essential

**Current:** Unit/integration coverage and media smoke tests catch meaningful failures, but valid JSON and a playable MP4 do not establish usefulness. Real authenticated capture and several cloud/provider paths are unverified.

**Change:** Maintain representative fixtures: an authenticated task app, an AI tool with delayed output, a commerce/catalog demo and a portfolio. Cover public and signed-in navigation, awkward viewport sizes, loading states and long labels. Test capture → upload → analysis → plan → edit → render → reopen/download. Add multi-tab edits, connection loss, low storage and duplicate job delivery. Build visual/audio checks for crop, text overflow, missing/black frames, frozen footage, caption alignment, clipped speech and exports differing from previews. Have a person watch the complete film and assess its story; model grading can flag problems but cannot approve quality on its own.

**Acceptance:** For every release candidate, retain source evidence, storyboard, final film, technical results and human review. The reviewer should be able to state what the product does, name the shown benefits and identify the demonstrated outcome without explanation from the developer.

## Proposed implementation shape

Extend existing contracts with versioned records rather than storing a larger unstructured prompt:

- **ProductBrief:** product name, audience, outcome, priority features, target channel/duration, brand and CTA.
- **CaptureSession / Journey:** approved scope, state graph, task steps, recordings, privacy configuration and capture status.
- **InteractionEvent / EvidenceSegment:** source hash, time range, action, visible result, sanitized control label, focal bounds, confidence and analysis version.
- **StoryBeat / EditDecision:** viewer takeaway, evidence references, source in/out, playback changes, framing keyframes, overlays, sound cues and locked decisions.
- **AudioTrack:** source, time range, level/fades, speech alignment and provenance.
- **GenerationJob / ExportVersion:** immutable input manifest, stage results, provider/model/version, reservations/usage, approved scope and output artifacts.

The processing order becomes capture → analyze → propose story → compile editable timeline → preview/revise → approved optional media generation → render → quality review. Missing evidence loops back to targeted capture. Expensive generation should not precede a reviewable film plan. Bounded analysis and caching control costs; no custom model training is necessary for this approach.

## Implementation order and release gates

1. **Protect the foundation:** isolate environments, resolve SMTP, implement data lifecycle, deploy the already-tested runtime fixes through review. Keep current customer work readable.
2. **Make one excellent real product demo:** add journey capture, timed evidence, recording analysis and action/result story planning. Prove the loop on Cue itself before expanding styles.
3. **Make the edit good:** add purposeful framing, trimming, continuous cuts, readable overlays and visual storyboard review. Watch a complete film before proceeding.
4. **Complete sound and generation:** narration alignment, music/SFX, targeted generative accents, cost controls and selective regeneration.
5. **Finish the customer workflow:** guided onboarding, connection verification, project/version management, accessibility and export variants.
6. **Verify hosted operation:** run the full application without local workers, failure/recovery and isolation tests, restore drill, realistic load/cost measurements and release review. Promote manually after the reviewed candidate passes.

These are cohesive implementation slices, not permission checkpoints for every small change. Teams, realtime collaboration, subscriptions and custom-trained models can wait; they are not prerequisites for the user's current goal. Chrome Store distribution is a sensible onboarding improvement, but its review is an external gate; do not promise it has shipped before approval. Review the [Remotion license](https://www.remotion.dev/license) for the actual operating model before commercial rollout.

## The demonstration that should replace the current test film

A 25–35 second Cue showcase should show a signed-in product being captured, the real capture arriving, a storyboard proposal appearing, a scene being trimmed/reframed, and the resulting film playing. Waiting for AI is edited down while the visible before/action/result relationship stays truthful. A short ending presents the product name and a useful CTA. Music and any generated opening support this sequence.

The same workflow must then succeed on a different application. Cue demonstrating only its own prearranged fixture would not prove general website-to-video behavior.

## Source map

- Capture/discovery/redaction: `apps/extension/service-worker.js`, `shared.js`, `offscreen.js`.
- Current director/evidence limits: `packages/director/index.ts`, `packages/providers/index.ts:195`, `apps/worker/runner.ts:128`.
- Scene/timeline data: `packages/contracts/index.ts`.
- Current visual/audio behavior: `packages/compositor/Scene.tsx`, `Film.tsx`, `Visual.tsx`.
- Editing and save behavior: `apps/editor/components/editor/useEditorController.ts`, `SceneInspector.tsx`, `BriefInspector.tsx`, `ProposalScene.tsx`, `AudioInspector.tsx`.
- Saved-key versus verified-connection distinction: `packages/storage/credentials.ts`, `apps/editor/components/ProviderConnection.tsx`.
- Lifecycle/cost/API boundaries: `packages/server/api.ts`, `packages/storage/db.ts`, `packages/cloud/cleanup.ts`.
- Runtime/cloud release: `packages/storage/client.ts`, `packages/cloud/render.ts`, `apps/editor/workflows/job.ts`, `scripts/sandbox-bootstrap.sh`, `docs/releases.md`.
- Existing checks and outstanding live gates: `docs/VERIFICATION.md`, `tests/`, `.github/workflows/ci.yml`.
