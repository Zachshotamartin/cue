# Cue security boundaries

The account-based release is being implemented. See PRODUCTION_PLAN.md and VERIFICATION.md for deployment gates and checks; do not mistake source code for verified infrastructure.

## Accounts and authorization

Supabase managed authentication validates sessions. Protected pages redirect to sign-in; every API also validates the session and resolves the project owner before reading or writing its assets, jobs, revisions, captures or keys. Visiting a URL no longer creates an account or issues an installation-wide credential. Server-side mutation origin checks are independent of UI redirects. Verified email is required for provider keys and billable operations.

## Provider credentials

User keys are AES-256-GCM encrypted in Postgres with a fresh 96-bit nonce and an authenticated owner/provider/version context. The 256-bit master key is a Vercel sensitive server environment value, separate from the database. Status responses return only the provider name, configured state and suffix. No production fallback uses the operator's keys. Cue's server necessarily decrypts a key to call its provider; this is encrypted storage, not end-to-end encryption. Do not claim protection from a compromised application server with access to its master key.

Keep an encrypted offline copy of CUE_MASTER_KEY under the operator's control. Losing it requires users to enter keys again. Rotation must decrypt/re-encrypt rows in a controlled migration before retiring the previous key. Never overwrite the key on a deployment and silently break users' connections.

## Media and capture

Private Vercel Blob stores captures, upload chunks and outputs. Asset routes authenticate the owner; isolated renderers receive expiring asset capabilities. Capabilities expire and do not grant project or credential access. User cookies from captured websites stay in the browser extension. Pairing codes are hashed, single-use, expire after ten minutes, and grant only a 24-hour capture token for one project. Tokens can be revoked in the editor.

Uploads are bounded, checksum-checked, content-inspected and normalized. Extension screenshot masking is not a promise of perfect redaction. Recordings still require the user's review before upload. Website auth cookies, session storage and raw DOM state are not imported.

## Jobs and spending

Each request carries an idempotency key; immutable inputs, budget reservation and job creation are committed together. Known provider task IDs are polled after interruption. Uncertain submissions are not automatically repeated. The user must reconcile provider billing first. Server-side job claims prevent duplicate delivery from executing a provider call twice. Cloud rendering runs in a bounded Sandbox with a job-scoped callback token and no provider keys or database credentials.

The initial service limits accounts to 100 projects, 1 GiB of media, three active jobs, and five cloud exports/hour. Provider charges use the user's own account. These limits do not constitute a paid billing product.

## Operations

Keep production and development databases/stores separate. Do not put production secrets in preview branches or Git. Vercel deployment protection does not replace application authentication. Do not log full requests to the key endpoints, provider bodies, signed media URLs or callback tokens. The local SQLite adapter is explicitly opt-in outside tests and cannot be used on Vercel as durable storage.

Account export is available through project ZIP/MP4/SRT downloads. Archive is reversible; media retention is intentional. The original local .data directory is preserved by the import script. Database restore retention depends on the actual Supabase plan and must be verified in its console; a free plan is not an independent backup strategy.
