import Link from "next/link";
import { Nav } from "../../components/Nav";
export default function Privacy() {
  return (
    <>
      <Nav />
      <main className="reading-page">
        <p className="eyebrow">Data & privacy</p>
        <h1>Your work stays yours.</h1>
        <p className="reading-lede">
          What Cue stores, what leaves your account, and how to remove it.
        </p>
        <section>
          <h2>Captures and projects</h2>
          <p>
            Cue saves your film brief, edits, media, generated takes, job
            history and exports to your account. The hosted app uses Supabase
            for accounts and its private database, and Vercel for processing and
            private media storage. Closing a tab does not delete saved work.
          </p>
          <p>
            The extension records only the tab you select. Your website login
            stays in Chrome. Screenshots and recordings remain in the extension
            until you choose to upload them. Clear unwanted local captures from
            the extension separately from cloud media.
          </p>
        </section>
        <section>
          <h2>AI requests</h2>
          <p>
            When you request a storyboard, your selected screenshots, sampled
            recording frames, sanitized page text and film brief go to the
            planner you choose: OpenAI, Anthropic or Google. Video generation
            sends the selected source image and motion prompt to Runway.
            Narration, music and sound effects send the selected text and voice
            settings to ElevenLabs. Provider retention and usage terms depend on
            your account with each provider.
          </p>
          <p>
            Each service uses your saved account key. Keys are encrypted at rest
            with account-bound authenticated encryption, stay server-side, and
            are excluded from film archives and the capture extension.
          </p>
        </section>
        <section>
          <h2>Privacy masks</h2>
          <p>
            Mark private elements before recording and review the complete
            result before uploading. Automatic masking covers common sensitive
            inputs; it cannot identify every confidential detail. Imported
            recordings can be copied with fixed-area masks and audio removal. A
            source marked for masking is excluded from new planning and export
            until you replace it with the reviewed safe copy.
          </p>
        </section>
        <section>
          <h2>Retention and removal</h2>
          <p>
            Projects remain until you delete them. Old revisions and unused
            takes can be permanently removed from Export → Clean old media &
            history. Download an archive first if you may need to restore those
            edits. Account deletion in Settings requires your password and
            removes Cue records and sign-in identity. Finish or reconcile
            outstanding jobs before deleting an account or project.
          </p>
          <p>
            Unreferenced media is queued for cleanup after deletion; shared
            media remains while another film references it. Cleanup retries
            storage failures. Unfinished upload chunks expire after a day.
            Infrastructure backups, provider records and already-downloaded
            copies follow their separate retention schedules.
          </p>
        </section>
        <Link className="button" href="/settings">
          Account & connections ↗
        </Link>
      </main>
    </>
  );
}
