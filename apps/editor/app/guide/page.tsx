import Link from "next/link";
import { Nav } from "../../components/Nav";
export default function Guide() {
  return (
    <>
      <Nav />
      <main className="reading-page">
        <p className="eyebrow">From your browser to the screen</p>
        <h1>Make your first film.</h1>
        <p className="reading-lede">
          Start with a real task in your product. Capture the action and its
          result, review a story, then shape the final cut.
        </p>
        <section>
          <h2>Capture your product</h2>
          <p>
            Create a film in the studio. In its Capture panel, generate a
            pairing code. Download the extension, unzip it, open{" "}
            <code>chrome://extensions</code>, enable Developer mode and choose
            Load unpacked. Select the unzipped Cue Capture folder.
          </p>
          <p>
            Open your website, click Cue Capture, and enter the project’s code.
            Find pages and approve routes for capture, or record the checklist
            from your brief. Show the starting state, perform a task, and hold
            on its result. Pause during waiting, mark useful moments, and review
            each recording before sending it to Cue. Full page navigation ends
            the current segment; record the next step after the new page loads.
          </p>
          <a className="button" href="/downloads/cue-capture.zip" download>
            Download extension
          </a>
          <p>
            You can also import PNG, JPEG, WebP, AVIF, MP4, WebM, WAV, MP3, Ogg
            and FLAC files. The limit is 64 MiB per file. Use a screen-sized
            image instead of an entire long page for readable results.
          </p>
        </section>
        <section>
          <h2>Shape the story</h2>
          <p>
            Build a starter storyboard from your captures, or connect OpenAI,
            Claude or Gemini in Settings and choose your planner in Brief. Write
            the product name, audience, priority features, target length and
            call to action first. Recordings are analyzed into timecoded
            moments. A playable proposal shows the action, result and source
            trim before it changes your timeline. A demonstration needs actual
            product footage; choose a teaser if you only have still images.
          </p>
          <p>
            Select a scene to change its title, caption, length, movement or
            source. Exact UI preserves your real screenshot or recording. Use
            timeline handles or clip controls to trim, split and change speed.
            Draw a crop on the source, set an ending crop for a camera move, and
            add timed click highlights. Lock scenes you want to keep when
            replanning, or ask AI to revise just one scene. Generated video uses
            a selected Runway take. Hybrid places your real interface over
            generated footage.
          </p>
        </section>
        <section>
          <h2>Generate with intention</h2>
          <p>
            Connect your Runway key, select a scene and describe its motion. The
            generation panel shows the estimated cost before submission. Each
            result becomes a separate take; your original remains intact. Select
            the take you want to use.
          </p>
          <p>
            AI video can distort small text. Use exact UI for explanations and
            demonstrations, and generated scenes for movement and atmosphere.
            Check the film at normal playback speed before exporting.
          </p>
        </section>
        <section>
          <h2>Give it a voice</h2>
          <p>
            Connect ElevenLabs, preview its available voices and select one.
            Edit narration across the film or per scene, then generate only the
            scenes you want. New speech includes timed captions. Imported audio
            remains available too; allow enough time for the complete sentence.
            Generate instrumental music or short effects, or upload licensed
            audio. Adjust cue timing, trim, level and fades. Music ducks during
            speech, and the final export normalizes audio to a consistent level.
          </p>
        </section>
        <section>
          <h2>Export the final cut</h2>
          <p>
            Choose landscape, portrait or square, review the framing, and export
            an MP4. Rendering runs in the cloud, independently of your browser.
            Closing the editor does not discard accepted jobs. The export panel
            checks for missing sources, invalid trims, cut-off speech and
            private originals. Download aligned speech captions, a poster and a
            portable project archive. Unzip that archive and use Restore archive
            in Your films to bring back the editable project, with its media
            verified. Projects also support duplication, search, archival and
            permanent deletion. Clean old history only after saving any variants
            you need.
          </p>
        </section>
        <section id="privacy">
          <h2>Your screens. Your keys.</h2>
          <p>
            Your projects and media are saved privately to your account. AI
            providers receive selected sources only when you request a provider
            operation. Your website login is never copied into Cue. Selected
            element masks also apply while recording. Imported media can be
            redacted into a separate safe copy, which must be reviewed from
            start to finish. Automatic masks are not a guarantee: select
            additional sensitive areas yourself, and check audio as well.
          </p>
          <p>
            Provider keys saved in Settings are encrypted for your account. Each
            service uses your own key. Keys are never included in downloads or
            sent to the capture extension.
          </p>
          <p>
            Generation costs are provider estimates, not an invoice. Cancelled
            or uncertain requests can still be billed. If a submission cannot be
            confirmed, check the provider dashboard before retrying.
          </p>
        </section>
        <p>
          <Link href="/privacy">
            Read the full privacy and data-processing policy.
          </Link>
        </p>
        <Link className="button" href="/projects">
          Open studio ↗
        </Link>
      </main>
    </>
  );
}
