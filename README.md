# Cue

**Your product. In motion.** Capture a website's real screens, direct a story, edit a film and export it. Cue saves films, source assets and generation jobs to your account.

**Hosted preview:** [cue-tau-green.vercel.app](https://cue-tau-green.vercel.app). This hosted preview runs the previously deployed release. The workflow upgrade on this branch is verified locally and awaits release review; public email signup needs custom SMTP and authenticated extension capture remains a separate acceptance check. See [the production plan](docs/PRODUCTION_PLAN.md) and [verification record](docs/VERIFICATION.md).

## Application

- A guided Brief → Capture → Story → Edit & sound → Export workflow, with recording analysis, source intervals, visual crops, callouts, clip speed/split/locks and a shared Remotion preview/export timeline.
- Exact UI animations, generated clips and hybrid scenes; generated takes never overwrite sources.
- A Chrome extension for explicitly reviewed screenshot routes and interaction recordings, including authenticated sites without exporting login cookies.
- Account-based project library, revisions, autosave, conflict recovery, private media and encrypted user-supplied provider keys.
- Runway atmosphere generation; OpenAI, Claude or Gemini evidence-based storyboarding; ElevenLabs aligned narration, pronunciation dictionaries, instrumental music and sound effects. These features require each user's own provider keys, access and credits. Generated footage cannot replace demonstrated UI actions.
- PostgreSQL job records, Vercel Workflow orchestration and bounded Sandbox rendering independent of an open browser.

## Production infrastructure

Next.js is hosted on Vercel. Supabase provides Postgres and managed authentication. Vercel Blob holds private media; Workflow and Sandbox execute durable jobs and renders. No production project relies on a developer's laptop filesystem or a shared operator API key.

1. Create/link the Vercel project and provision Supabase with Auth plus a private Blob store. Use a dedicated project, enable email confirmation and configure the exact application callback URLs.
2. Configure the server-only values in `.env.example`. Use the provider CA through DATABASE_CA_BASE64 for verified database TLS. Generate independent 32-byte secrets; use Vercel CLI sensitive envs. Keep an encrypted operator backup of the encryption key.
3. `npm ci`, `npm run db:migrate`, `npm run check`.
4. Publish the source commit and set `CUE_RENDER_REF` to that commit. Follow the [manual release process](docs/releases.md): stage the Vercel deployment, verify it, then promote it. GitHub CI runs checks; it does not automatically deploy production.
5. Configure custom SMTP in Supabase for public signup and password recovery. Supabase’s default sender only delivers to organization members. Then enable the prepared confirmation/recovery templates in supabase/config.toml.
6. Create and verify an account. Add provider keys in Settings. Verify save/reload, account isolation, exports and provider execution before announcing a production release.

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

`npm run extension:build` creates `dist/cue-capture.zip`. Load the unpacked `apps/extension` folder for local development. Open a project, choose Capture, and pair the extension with the project's one-time code. It requests access to your chosen HTTPS Cue address. Review route selection, screenshot masks and recordings before uploading. The updated authenticated-browser capture test is pending installation/permission confirmation. Recordings support a guided journey, pause/resume, sanitized interaction markers and optional tab audio. Review every mask and recording before upload; imported-media masks are static.

## Provider keys

- [Runway developer portal](https://dev.runwayml.com/): create a developer API key and fund that account.
- [OpenAI API keys](https://platform.openai.com/api-keys): add an API key with model access and API billing. A ChatGPT subscription is separate.
- [Anthropic API keys](https://platform.claude.com/settings/keys): add a Claude API key with API credits. A Claude subscription is separate.
- [Google AI Studio](https://aistudio.google.com/apikey): create a Gemini key with access to the configured model.
- [ElevenLabs API keys](https://elevenlabs.io/app/settings/api-keys): create a key with access to the voice, music and sound-effect APIs you intend to use.

Choose the storyboard provider in the film’s Brief panel. Cue saves this choice per film and records the provider and model on each proposal; applying a proposal is always a separate step. The initial planner models are GPT-5.4 mini, Claude Sonnet 4.6 and Gemini 2.5 Flash. Operators can set OPENAI_PLANNER_MODEL, ANTHROPIC_PLANNER_MODEL or GEMINI_MODEL for new jobs; queued jobs keep their recorded model.

Keys are encrypted at rest per account and used only for explicit requests. Free connection/voice checks are separate from paid generation. Cue can capture and edit without AI keys, and accepts uploaded music or sound effects. Provider usage is estimated, with project/account/global reservation limits; it is not an invoice reconciliation service. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for exact current capabilities and release gates.

See [security](docs/SECURITY.md), [architecture](docs/ARCHITECTURE.md), and [upstream provenance](UPSTREAM.md). Public visibility does not grant a license absent an explicit license file.
