import {
  Browser,
  FilmStrip,
  SlidersHorizontal,
} from "@phosphor-icons/react/dist/ssr";
export function HomeWorkflow() {
  return (
    <section className="workflow" id="workflow">
      <h2>
        From browser
        <br />
        to first screening.
      </h2>
      <div className="workflow-list">
        <article>
          <Browser size={26} />
          <div>
            <h3>Bring the real thing.</h3>
            <p>
              Capture a signed-in website with the Chrome extension, record a
              workflow, or drop in your own media.
            </p>
          </div>
        </article>
        <article>
          <FilmStrip size={26} />
          <div>
            <h3>Find the story.</h3>
            <p>
              Shape a storyboard, choose your framing and give every scene a
              reason to be there.
            </p>
          </div>
        </article>
        <article>
          <SlidersHorizontal size={26} />
          <div>
            <h3>Make the cut yours.</h3>
            <p>
              Generate movement, compare takes, add a voice and export a film in
              the format you need.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
