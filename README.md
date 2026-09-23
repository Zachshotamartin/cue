# Cue

**Your product. In motion.** A private, local studio for turning real product screens and recordings into directed promotional films.

![Cue](apps/editor/public/brand/cue-brand-kit.png)

Cue contains a Chrome capture extension, a Next.js editor/API, a durable Node worker, and a shared Remotion composition. Real screenshots remain editable alongside optional AI-generated takes. The editor has no dependency on a training run.

## Run locally

Requirements: Node 22.18+ (24 LTS recommended), npm, FFmpeg/ffprobe on PATH, and Google Chrome. On macOS the renderer discovers the standard Chrome installation; elsewhere set `CUE_CHROME_PATH` to an installed compatible Chrome executable.

```sh
npm ci
npm run extension:build
npm run dev
```

Open **http://127.0.0.1:5303**. The command starts the editor and worker together. Keep the terminal running while jobs finish. Rendering is restricted to one frame worker to limit interference with other workloads.

```sh
npm run seed       # Add the included real Cue screenshot example
npm run check      # Typecheck, regression tests, production build
npm run test:e2e   # Running server required; real landscape/portrait renders
```

For a production-mode local preview, stop `dev`, then run `npm run build` and `npm start`. Do not run Next build and dev against the same output directory simultaneously.

## Make a film

1. Create a project. Import screenshots/recordings or pair Cue Capture.
2. Review the captures. Exclude any screens you do not want sent to the AI director.
3. Set the product brief, audience, CTA and colors. Build a starter cut or request an AI storyboard. Proposals identify their evidence and need your review.
4. Edit scene order, layout, captions, timing, motion, framing and sources. Changes are saved as immutable revisions; undo/redo operates on the current edit session.
5. Optionally generate Runway takes. Choose **Exact UI**, **Generated video**, or **Hybrid** for each scene. Original captures and previous takes are retained.
6. Assign recorded or generated narration and licensed music. Cue prevents export from cutting off narration or reading beyond a clip.
7. Export MP4 in landscape, portrait or square. Download the poster, scene-level SRT captions and project ZIP.

**Exact UI is a deterministic composition, not generative video.** Generated video can distort interfaces; review every take. Hybrid composites the original interface over a generated background with controlled camera motion. It does not track UI onto arbitrary generated screens.

## Capture signed-in websites

Download Cue Capture from `/guide`, or use `dist/cue-capture` after packaging. In Chrome, open `chrome://extensions`, enable Developer mode, and load that directory unpacked. This is a development extension, not a Chrome Web Store release.

In Cue, open **Capture a website → Generate pairing code**. In the source website tab, open Cue Capture and pair it with the local studio. Click **Find pages in this tab**, review the same-origin route selection, then capture selected routes or a named current state. The batch limit is 25; other routes remain listed. Failed pages can be retried. Finish SSO/login yourself, return to your application, and resume. Cue does not click arbitrary website buttons or copy login cookies.

The extension masks password/email fields and user-selected elements before saving screenshots. Matching text is excluded from evidence. Recordings are user-driven, capped at 60 seconds, silent, and persisted in IndexedDB chunks. They require sanitized demo data and manual review; screenshot masks do not automatically track private content in video. Navigation to a different origin discards the current recording. The original URL and scroll position are restored best-effort after a batch.

Pairing codes expire after 10 minutes and work once. Capture tokens expire after 24 hours and are limited to one project. Imported assets are validated by their actual bytes, dimensions and duration; uploads use chunks and a final checksum. The browser retains the local capture until you discard it.

## Optional AI providers

The application runs capture, editing and local exports without provider keys. Add your own keys in **Settings**, or copy `.env.example` to `.env` and set only the providers you need:

- **Runway:** image-to-video (`gen4_turbo` or `gen4.5`, 5/10 seconds).
- **Gemini:** multimodal, structured storyboard proposals. `GEMINI_MODEL` can select another supported model.
- **ElevenLabs:** optional stock-voice narration using your chosen voice ID.

Keys saved in Settings use AES-256-GCM with owner/provider-bound authenticated data. The local master key is stored separately with restricted file permissions; `CUE_MASTER_KEY` can supply a 32-byte hex key from your environment. Keys never enter project archives or the extension.

This is an **owner-only loopback application**. Do not expose it publicly or put a tunnel in front of it. It has no hosted user accounts. Before external users can run AI, the hosted version must add real authentication, tenant isolation, managed encryption keys, PostgreSQL/object storage and mandatory per-user keys. Other owners never fall back to the local owner's provider credentials.

Generation shows a cost estimate and reserves project budget before queuing. Provider billing remains authoritative. An interrupted submit without a saved task ID becomes **unknown** and is not automatically repeated. Check provider history, then resolve it in **Export → Job history**. Saved task IDs are polled after restart without submitting another generation. Cancelling a provider task may still incur its charge.

## Data and restart behavior

Projects, media, jobs, revisions, encrypted credentials and events live in `.data/`, outside Git. Back up the entire directory while Cue is stopped, including the encryption/session key files. Project ZIPs contain sanitized media and a JSON manifest with selected takes, but not provider keys, cookies or private installation credentials.

Stop Cue with Ctrl-C. The worker stops after saving the current job. If a process exits abruptly, leases expire and saved provider tasks resume polling. Completed capture images and recording chunks survive browser restarts. Unknown provider submissions require manual reconciliation to avoid duplicate billing.

## Verification and limits

See [verification notes](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md), [brand guide](docs/BRAND.md) and [upstream provenance](UPSTREAM.md).

The automated suite covers auth/origin checks, encryption and owner isolation, edits/history, budget reservations, duplicate jobs, recovery, media normalization, byte ranges, resumable uploads, recording chunks and provider request contracts. `test:e2e` exercises the actual server/worker/compositor and exports two playable MP4s with audio.

Live provider calls require configured accounts and an approved test budget. Stubbed provider tests do not establish real generation quality. The manual Chrome extension capture/recording matrix must also be completed before release. Nothing is deployed automatically.
