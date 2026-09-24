# Cue workflow verification — September 23, 2026

This record separates current local evidence from earlier production/provider tests. The production site has **not** received the workflow changes in this PR. Scope and release gates are in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Current branch: automated and database checks

- `npm run typecheck`: passes.
- `npm test`: **123 tests across 19 files pass**. Coverage includes ownership/CSRF, revision conflicts, encrypted credentials, resumable uploads, provider wire contracts, timed captions, capture pause/event timing, route bounds, evidence relevance, trim/split/crop timing, privacy exclusions, scoped story revision, lifecycle/restore, unknown paid submissions, queue fairness, spending reservations and environment guards.
- `npm run build`: extension packaging and optimized Next.js/Workflow production build pass.
- `npm audit --omit=dev`: zero reported vulnerabilities at verification time.
- `scripts/verify-postgres.ts` passes against a dedicated local PostgreSQL database. Checks include tenant isolation, concurrent edits, idempotency/budgets, exclusive job claims, rate limits, snapshots and simultaneous analysis/rights/privacy metadata updates. The script removes only its own synthetic rows.
- Review caught and corrected lost privacy flags during concurrent metadata writes, generated footage being offered as product evidence, an incorrect voice-picker endpoint, edit operations that could exceed the scene limit, and a first-story check that incorrectly required recordings to already be on the timeline. Stale poll responses also cannot replace a newly acknowledged save.

Commands for repeating the non-browser integration checks:

```sh
# Dedicated disposable verification database only; never the production database.
CUE_VERIFY_DATABASE=1 NODE_ENV=test DATABASE_URL='postgresql://localhost/cue_verification' npx tsx scripts/verify-postgres.ts
npx tsx scripts/verify-compositor.ts
```

## Current branch: real media output

`scripts/verify-compositor.ts` generated a synthetic recording and rendered it with real Remotion/FFmpeg. No provider API or account data is involved. All three six-second exports passed H.264/AAC, exact duration and dimensions:

| Format    | Dimensions  | Measured duration |
| --------- | ----------- | ----------------- |
| Landscape | 1920 × 1080 | 6.000 s           |
| Portrait  | 1080 × 1920 | 6.000 s           |
| Square    | 1080 × 1080 | 6.000 s           |

Fixtures exercise source trim, 1.5× playback, animated crop, timecoded callout, aligned speech captions, narration/music/SFX, transitions and an endcard. Frames around transition boundaries and representative portrait/square frames were inspected. Measured synthetic audio was -16.04 LUFS with a peak below the -1.5 dBTP ceiling. This proves the tested composition/output mechanics; it does not judge a real product film's story or visual appeal.

Generated fixtures/results stay in ignored `.data/compositor-verification/` and are not public repository assets.

## Current branch: browser checks

Checks use the signed-in localhost editor with isolated application data and a duplicated verification film. The original paid-test film is unchanged.

- Desktop editor and 390 × 844 layout reviewed; no horizontal document overflow on mobile. The workflow bar/timeline intentionally scroll horizontally within their own regions.
- Title/caption save and reload retain edits. Undo restores the prior edit. Sidebar collapse/expand and inspector navigation work.
- The saved ElevenLabs key loads real stock voices through the free listing endpoint; no new narration/video/music generation was submitted.
- Importing a seven-second synthetic recording through the browser succeeds. The local worker analyzes it and the editor displays ten timecoded evidence thumbnails.
- Changing playback to 2× preserves the selected source interval; scene duration becomes 2.5 seconds. Scene locking and a timecoded “Visible result” highlight persist and display correctly.
- A browser-initiated export using existing footage, saved narration and the edited synthetic clip completed: **25.500 seconds, 1920 × 1080**. Its immutable manifest records compositor `2.0.0`. The exported frame at 23.5 seconds was inspected: 2× source playback and the “Visible result” callout appear correctly. No new paid generation was needed.

The updated Chrome extension has **not** been installed/tested in the user's existing profile during this verification. Permission confirmation is pending. No browser-profile workaround or unapproved permission grant was used.

## Earlier integration evidence — before this workflow implementation

The previous source/deployment verified Supabase account ownership, private PostgreSQL/RLS, private Blob read/write, encrypted per-account keys, real sign-in, cross-origin rejection and saved work across deployments. Two-second cloud Workflow/Sandbox landscape and portrait exports completed. These are baseline checks, not proof that every new stage runs correctly in the hosted environment.

Using the owner's saved keys, a separate earlier localhost film (“Cue — live provider check”) completed an OpenAI `gpt-5.4-mini` four-scene proposal, one Runway `gen4_turbo` take and ElevenLabs `eleven_multilingual_v2` narration. Its combined export measured 23.019 seconds at 1920 × 1080. Cue recorded $0.55 in conservative estimated charges, not a reconciled provider invoice. Reload/new-tab persistence retained the proposal, selected take, narration and export.

That film was rejected for creative quality: it primarily showed marketing screenshots rather than demonstrating a product workflow. Successful API requests did not establish a useful promotional result. It is not presented as creative acceptance for this PR.

## Required before public-release approval

1. Confirm extension installation/permissions and exercise a real authenticated app with navigation, modal/form state, masks, pause, result markers, cross-origin handling, recovery and resumable upload.
2. Configure verified-domain SMTP and independent staging resources; verify an unrelated user's signup, confirmation, reset and recovery. Do not enable public enrollment before those checks.
3. Exercise new hosted Workflow analysis/provider/render stages with the browser and local worker closed; test throttling, cancellation and ambiguous paid recovery with a bounded approved budget. Live Claude/Gemini, music, SFX and pronunciation/aligned-speech generation remain unverified here.
4. Rehearse infrastructure backups/credential rotation and an archive restore/render in staging. The local restore and rotation contracts are covered; operator backup configuration is external.
5. Watch a newly captured, AI-directed real product demonstration end to end, including sound and phone-sized output. Do not substitute synthetic fixtures or the old slideshow for this acceptance check.
