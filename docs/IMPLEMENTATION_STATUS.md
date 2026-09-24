# Cue production workflow — implementation status

Scope: the single production-workflow PR, following [the audit](PRODUCT_READINESS_AUDIT.md). This is a source/local verification record, not a production deployment claim.

## Implemented

- **Brief and capture:** separate product/film names; objective, duration, destination, features, journey and CTA; guided capture checklist; bounded approved-route discovery; pause/resume; optional tab audio; timecoded sanitized interactions/result markers; element-following recording masks; reviewable static redaction for imported media.
- **Evidence and direction:** cached, hash/version-bound recording analysis; frames near actions and visual changes; relevance-ranked evidence; action/result source intervals; illustrated proposals; individual scene revision; retained locked scenes; warnings or blocking checks for missing workflow footage, private originals, invalid timing, speech cutoff and synthetic UI demonstrations.
- **Editing and composition:** five-step workflow; visual source crop and end crop; timecoded highlights/callouts; source trim/speed/split/duplicate/lock; accessible timeline duration handles; smooth shared transitions; original UI foreground for hybrid scenes; shared editor/export composition and three aspect ratios.
- **Sound:** saved voice picker, narration scripts, provider pronunciation dictionaries, aligned speech captions, waveforms, instrumental music/SFX adapters, uploaded audio, source-audio controls, timed sound cues, speech-window ducking, fades, audio rights/credit notes and measured output loudness normalization.
- **Saving and lifecycle:** versioned drafts, conflict/recovery handling, undo/redo, library search, project duplication, archive/permanent deletion, reference-aware media/history cleanup, checksummed resumable archive restore and reauthenticated account removal. Metadata changes merge under row locks so concurrent analysis/rights updates preserve privacy flags.
- **Operations:** incremental migrations and database environment tags; isolated local application data; credential key rotation; account/global spending reservations; fair bounded job claims; render/storage allowances; durable staged analysis; immutable job input and export manifests; account-scoped diagnostics; cleanup of abandoned uploads and unreferenced objects.
- **Structure:** shared UI/compositor primitives; editor persistence and notification hooks; separate settings, lifecycle, account, evidence, editing, redaction, restore and diagnostics modules; backwards-compatible defaults for existing films.

## Verified locally

See [VERIFICATION.md](VERIFICATION.md) for exact evidence. TypeScript, 123 automated tests, the production build and extension packaging pass. Real PostgreSQL isolation/concurrency checks and real landscape/portrait/square render fixtures pass. Browser checks cover desktop/mobile, save/reload, undo, sidebar controls, free voice listing, upload, recording analysis and editing. No additional paid AI generation was performed for these workflow checks.

## Release gates and limits

- **Authenticated Chrome capture:** the updated extension is packaged; a real signed-in capture with its debugger/tab-recording permissions still needs the pending user confirmation. Algorithm/unit tests do not replace that test.
- **Public enrollment:** verified-domain SMTP and unrelated-account confirmation/recovery must be configured and exercised. The provider choice is pending. Registration stays disabled unless the operator enables it. Independent hosted staging identity/storage and external infrastructure backups also remain to be provisioned.
- **Hosted integrations:** the new paid provider stages, music/SFX/updated aligned speech and cancellation/recovery need live provider/Workflow verification. Existing provider tests are distinguished from current mocked adapter coverage.
- **Creative acceptance:** synthetic render fixtures prove timing/media output, not promotional quality. A real authenticated product journey must be recorded, directed and watched end to end before advertising the generated films as production-verified.
- **Deliberately bounded behavior:** assisted capture uses approved routes and user-driven actions; it does not autonomously execute arbitrary forms. Analysis suggests intervals from events and visual changes, not a guaranteed semantic loading/idle detector. Imported masks are static and require full-clip review. Generated text/UI distortion requires human review. Rights fields record user/provider information; they do not certify licensing. Spending is estimated, not invoice reconciliation. Diagnostics surface issues in Settings; no external paging service is configured.

Local data lives in PostgreSQL `cue_development` and `.data/development`. Production was read only during the initial copy. Credentials were re-encrypted with a separate development key; active jobs and capture grants were not copied. Supabase identity is temporarily shared for sign-in only; `CUE_SHARED_AUTH_READ_ONLY=1` blocks local identity changes.

The current request authorizes one PR, not merging or deployment. Unrelated training processes were not touched.
