# Cue

**Your product. In motion.** Capture a website's real screens, direct a story, edit a film and export it. Cue is being upgraded from a local prototype to an account-based production application.

**Release status:** cloud account/persistence implementation is in progress. Read [the production plan](docs/PRODUCTION_PLAN.md) and [verification record](docs/VERIFICATION.md) before deploying. A public repository is not a claim that all external services are configured.

## Application

- An editable Remotion timeline with captions, crops, transitions, three treatments, voice-over and music uploads.
- Exact UI animations, generated clips and hybrid scenes; generated takes never overwrite sources.
- A Chrome extension for explicitly reviewed screenshot routes and interaction recordings, including authenticated sites without exporting login cookies.
- Account-based project library, revisions, autosave, conflict recovery, private media and encrypted user-supplied provider keys.
- Runway video generation, Gemini storyboarding, ElevenLabs narration. These features require each user's own provider keys and credits.
- PostgreSQL job records, Vercel Workflow orchestration and bounded Sandbox rendering independent of an open browser.

## Production infrastructure

Next.js is hosted on Vercel. Neon provides Postgres and managed authentication. Vercel Blob holds private media; Workflow and Sandbox execute durable jobs and renders. No production project relies on a developer's laptop filesystem or a shared operator API key.

1. Create/link the Vercel project and provision Neon with Auth plus a private Blob store. The account holder must accept marketplace terms.
2. Configure the server-only values in `.env.example`. Generate independent 32-byte secrets; use Vercel CLI sensitive envs. Keep an encrypted operator backup of the encryption key.
3. `npm ci`, `npm run db:migrate`, `npm run check`.
4. Publish the source commit and set `CUE_RENDER_REF` to that commit. Deploy with the Vercel CLI. GitHub Actions is not required.
5. Create and verify an account. Add provider keys in Settings. Verify save/reload, account isolation, exports and provider execution before announcing a production release.

## Development

Use Node.js 24. Install dependencies with `npm ci`. Copy `.env.example` to `.env.local` and configure a **development** database/auth endpoint/private Blob store, not the production resources. Run `npm run dev` at http://127.0.0.1:5303. The local worker runs alongside Next; deployed jobs use Workflow and Sandbox.

`npm run typecheck`, `npm test`, `npm run build` cover the application. `npm run test:e2e` requires `CUE_TEST_SESSION_COOKIE` for a dedicated signed-in test account; it has no admin bypass.

For isolated unit/CLI experiments, `CUE_LOCAL_DATABASE=1` explicitly selects SQLite. It does not enable production authentication and must never be used as cloud persistence.

## Importing existing local films

Keep the old `.data` folder. After creating and verifying your account against the target database, run:

```sh
npm run import:local -- your-verified-email@example.com /path/to/old/.data
```

The importer verifies ownership, preserves project/asset IDs and revision history, uploads media privately, skips already imported projects and does not delete local data or repeat paid requests. Provider credentials must be re-entered in Settings.

## Capture extension

`npm run extension:build` creates `dist/cue-capture.zip`. Load the unpacked `apps/extension` folder for local development. Open a project, choose Capture, and pair the extension with the project's one-time code. It requests access to your chosen HTTPS Cue address. Review route selection, screenshot masks and recordings before uploading. The real authenticated-browser capture test is currently postponed at the owner's request.

## Provider keys

- [Runway developer portal](https://dev.runwayml.com/): create a developer API key and fund that account.
- [Google AI Studio](https://aistudio.google.com/apikey): create a Gemini key with access to the configured model.
- [ElevenLabs API keys](https://elevenlabs.io/app/settings/api-keys): create a key with text-to-speech access.

Keys are encrypted at rest per account and used only for explicit jobs. Cue can capture and edit without AI keys. It does not currently generate music or sound effects; upload an audio track for the soundtrack.

See [security](docs/SECURITY.md), [architecture](docs/ARCHITECTURE.md), and [upstream provenance](UPSTREAM.md). Public visibility does not grant a license absent an explicit license file.
