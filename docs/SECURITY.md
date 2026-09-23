# Current security and storage model

Cue is an owner-only local application. It is **not a hosted multi-user service** and its local browser session is not a user-account login.

## Why there is no login screen

The supported start commands bind the web server to `127.0.0.1`. Opening a Cue page issues an HttpOnly, SameSite=Strict cookie for the local installation. API writes also check the request origin and configured Host. These controls restrict website-origin requests; they do not authenticate one person against another person using this computer.

Anyone who can use an authorized local browser session can operate Cue, including spending through configured provider keys. Local processes or a person with access to the Cue data directory may also obtain the installation credential. Do not expose this version through a public interface or tunnel. Hosted use needs real authentication and tenant authorization first.

## What is encrypted

Keys entered in Settings are encrypted before database storage using AES-256-GCM, with a fresh random nonce and owner/provider/version bound as authenticated data. The 32-byte master key is supplied through `CUE_MASTER_KEY` or created in `.data/encryption.key` with mode `0600`. `.data` is created with mode `0700`. The UI receives only configured status and the final four characters, not the saved full key. The extension and project ZIP do not receive provider keys.

The worker decrypts a key in memory when making an authorized provider request. The key and the data selected for that operation go to that provider over HTTPS. Encryption at rest does **not** protect against compromise of the computer, the account, or both the database and its master key. The local master key is a file, not an OS Keychain or hardware-backed secret.

A key placed in `.env` is **plain text**. Environment variables are an alternative source and are not re-encrypted automatically. Prefer Settings for encrypted local storage. Projects, screenshot/video/audio files, and exports are not application-encrypted.

## How saving works

- `.data/cue.sqlite`: projects, immutable saved revisions, job state, asset metadata, encrypted provider credentials, pairing codes and capture-token hashes. SQLite WAL is enabled.
- `.data/assets/`: imported captures/audio, generated takes, posters and exports.
- Chrome extension IndexedDB: captures and recording chunks awaiting review/upload; this is separate from Cue's server files.
- Chrome extension local storage: project pairing and capture progress; project-limited tokens expire after 24 hours.

Use **Save** for edits; navigation through Cue's editor header saves pending changes first. Capture uploads and completed jobs persist immediately. Closing a tab does not remove saved data. Unsaved edits are not the same as a saved revision. Back up the entire `.data` directory while Cue is stopped, including its key files; losing the encryption key makes saved API keys unreadable.

## GitHub and hosting at this check

On 23 September 2026 the Cue checkout has a local Git commit on `feature/cue` and no configured Git remote. No GitHub push or Cue Vercel deployment has been performed by this task. No `.vercel` link exists. `.env` and `.data/` are excluded from Git; `.env.example` contains empty provider values. No provider keys are configured in this installation.

Saving a key in local Settings does not upload it to Vercel or GitHub. A future hosted system would keep service secrets server-side and encrypt per-user provider keys in a tenant-scoped database with a separately managed master key. It must never silently use the owner's keys for other users.

## Obtain provider keys

Create keys in the provider's own website, then paste them into Cue's local `/settings` page. Do not put secrets into a Git commit or a chat message.

- **Runway:** open https://dev.runwayml.com/; create/select an organization, open API Keys, and create a key named Cue. The organization needs API credits. Instructions: https://docs.dev.runwayml.com/guides/setup/
- **Gemini:** open https://aistudio.google.com/apikey; create/select a Google Cloud project and create an API key. Use the current key type offered by AI Studio; set billing/quota controls for the chosen model. Instructions: https://ai.google.dev/gemini-api/docs/api-key
- **ElevenLabs:** open the workspace, select Developers → API Keys, and create a restricted key named Cue. Enable text-to-speech for the current integration and set a credit limit. Music and sound-effect generation are not wired into Cue yet. Instructions: https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key

Configuring a key does not itself generate media. Live tests still need an agreed spending limit before paid requests.
