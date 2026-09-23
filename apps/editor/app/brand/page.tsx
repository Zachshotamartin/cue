import { Nav } from "../../components/Nav";
import { Logo } from "../../components/Logo";
export default function Brand() {
  return (
    <>
      <Nav />
      <main className="page-shell brand-page">
        <p className="eyebrow">The Cue identity</p>
        <h1>
          A little direction.
          <br />A bigger story.
        </h1>
        <p className="lede">
          A framing bracket. A moment of orange. Space for your product to
          speak.
        </p>
        <img
          className="brand-board"
          src="/brand/cue-brand-kit.png"
          alt="Cue brand kit showing the framing mark, typography, colors, video editor application and campaign direction"
        />
        <div className="brand-downloads">
          <Logo />
          <a
            className="button secondary"
            href="/brand/cue-brand-kit.png"
            download
          >
            Download brand board
          </a>
          <a className="button secondary" href="/brand/cue-icon.svg" download>
            Download mark
          </a>
        </div>
      </main>
    </>
  );
}
