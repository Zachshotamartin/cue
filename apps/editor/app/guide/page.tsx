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
          Start with real product screens. Give them a story, then direct the
          motion.
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
            Find pages, choose what to capture, or open a specific product state
            and capture it yourself. Review each image before sending it to your
            project.
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
            the audience, product description and call to action first. A
            proposal is reviewed before it replaces your timeline.
          </p>
          <p>
            Select a scene to change its title, caption, length, movement or
            source. Exact UI preserves your real screenshot or recording.
            Generated video uses a selected Runway take. Hybrid places your real
            interface over generated footage.
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
            Import your own narration or connect ElevenLabs with a voice ID.
            Assign audio to each scene and allow enough time for the whole
            sentence. Add music you have permission to use; it lowers
            automatically under narration.
          </p>
        </section>
        <section>
          <h2>Export the final cut</h2>
          <p>
            Choose landscape, portrait or square, review the framing, and export
            an MP4. Rendering runs in the cloud, independently of your browser.
            Closing the editor does not discard accepted jobs. The export panel
            also offers scene captions, a poster and a project archive.
          </p>
        </section>
        <section id="privacy">
          <h2>Your screens. Your keys.</h2>
          <p>
            Your projects and media are saved privately to your account. AI
            providers receive selected sources only when you request a provider
            operation. Your website login is never copied into Cue. Screenshot
            masks are applied before transfer; review recordings carefully
            because moving private data needs special care.
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
        <Link className="button" href="/projects">
          Open studio ↗
        </Link>
      </main>
    </>
  );
}
