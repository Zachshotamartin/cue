# Checks and manual releases

GitHub CI runs `npm run check` (TypeScript, Vitest, extension packaging and the Next production build) for pull requests and pushes to `feature/cue`, the default branch. It uses Node.js 24 and needs no production credentials. It also supports manual dispatch.

Production deployment is manual. A merged pull request is not proof that production has been updated. When hosted runners are unavailable, run the same checks locally and record the result on the PR; do not report a blocked workflow as passing.

## Release

1. Review the diff and run `npm ci --no-audit` and `npm run check` on the release commit. Verify the affected UI in the browser. Authentication changes also need same-origin and cross-origin request checks.
2. Push and merge the PR. Sync `feature/cue`, confirm no tracked changes remain, and record `git rev-parse HEAD`. The source must be available on GitHub because render jobs clone this commit.
3. Confirm the Vercel CLI is linked to `zach-2267/cue`. Update the production `CUE_RENDER_REF` to the exact source commit using `vercel env add CUE_RENDER_REF production --force --yes --scope zach-2267` (supply the commit through stdin). Do not rotate encryption or signing keys when releasing.
4. From the repo root, run `npx --yes vercel@59.11.2 deploy --prod --skip-domain --yes --scope zach-2267`. This builds with production configuration but leaves the public domain on the previous deployment.
5. Check the staged deployment, then promote that exact URL with `npx --yes vercel@59.11.2 promote DEPLOYMENT_URL --yes --scope zach-2267`. Verify the public domain, sign-in, existing saved work and the changed interactions. Do not trigger paid generation merely to check a deployment.
6. Record the PR, source SHA, deployment URL and verification results. If a check fails, keep the previous deployment live. For a regression after promotion, use Vercel rollback to the previously verified production deployment.

`.vercelignore` excludes secrets, local data and test artifacts from CLI uploads. Never put environment values in PR comments or logs. The postponed authenticated-extension test, custom SMTP configuration and live AI-provider checks are separate from CI; a green build does not verify those integrations.

## Environment and launch gates

Local development now uses its own database and disk media. `CUE_DATA_ENVIRONMENT` must match `development`, `preview`, or `production`; a database records that tag at initialization and rejects a different environment. A preview must have its own Supabase project, Blob store and encryption/signing secrets. Never pull production env values into a local Next process. Sharing identity for local sign-in is an explicit transitional mode (`CUE_SHARED_AUTH_READ_ONLY=1`) and blocks sign-up, password changes and account removal.

Public email delivery is an external release gate: configure verified-domain SMTP in Supabase, then test an external email signup, confirmation and password reset before enabling public enrollment. `CUE_PUBLIC_SIGNUP=0` closes new registration while leaving existing sign-in working. `CUE_PUBLIC_SIGNUP=1` is the operator's declaration that the email flow has passed; it does not configure SMTP. Do not claim that env flag proves deliverability.

`/api/health` is authenticated and reports the current account's queue age, unresolved submissions, storage, environment and renderer release. Request failures log a correlation ID and category, without request bodies, source text, provider responses or keys. Investigate rising queue age and unknown submissions before scaling; default worker concurrency is six globally, two per account and two simultaneous render leases. A Workflow continues polling while capacity is occupied.

## Credential rotation

Deploy the new `CUE_MASTER_KEY` with the old value in `CUE_MASTER_KEY_PREVIOUS` to every web/worker instance. Reads accept either key with the existing account/provider authenticated context; all new writes use the new key. Back up the encrypted database before running `CUE_ROTATE_CREDENTIALS=1 npx tsx scripts/rotate-credentials.ts` in that environment. The script locks each account, verifies its replacement ciphertext, and is safe to rerun after interruption. Verify saved connections, take a new backup, then remove the previous key from all instances. Never put keys in shell arguments, files committed to Git, or release notes.

## Backup / restore drill

Export a project archive from the account, store it privately off the application's storage, unzip it, and use Studio → Restore archive. The importer verifies every media SHA-256 and requires complete source references before committing a new editable draft. Test a render from the restored film and compare the source hashes, frame count and representative frames. Archives do not contain provider credentials. Project archives complement the infrastructure provider's database backups; they do not back up identity accounts or billing records. Operators must configure independent database/media backups and rehearse their provider's restore procedure before public launch.

Every new render has a frozen input manifest (draft hash, media hashes, revision, compositor/director versions and release commit). Both local and hosted renders share the same audio normalization and output resolution/duration validation. The working-tree release label intentionally does not pretend uncommitted development code is an immutable Git release.
