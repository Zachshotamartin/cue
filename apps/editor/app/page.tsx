import Link from "next/link";
import { Nav } from "../components/Nav";
import { Logo } from "../components/Logo";
import {
  ArrowUpRight,
  Browser,
  FilmStrip,
  SlidersHorizontal,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
export default function Home() {
  return (
    <>
      <Nav />
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">A director for your website</p>
            <h1>
              Your product.
              <br />
              <span>In motion.</span>
            </h1>
            <p className="lede">
              Turn the thing you built into a film worth watching.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/projects">
                Open studio <ArrowUpRight size={18} />
              </Link>
              <Link href="/guide" className="text-link">
                See how it works <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <img
              src="/brand/frames.png"
              alt="Smoked-glass frames with a single orange edge, casting precise shadows"
            />
          </div>
        </section>
        <section className="intro-strip">
          <p>
            Your pages are the starting point.
            <br />
            The story is what you make of them.
          </p>
          <div>
            <span>Capture real screens</span>
            <span>Direct every scene</span>
            <span>Keep the final cut</span>
          </div>
        </section>
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
                  Capture a signed-in website with the Chrome extension, record
                  a workflow, or drop in your own media.
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
                  Generate movement, compare takes, add a voice and export a
                  film in the format you need.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="closing">
          <div className="closing-mark">
            <Logo compact />
          </div>
          <h2>
            Something good
            <br />
            deserves a good introduction.
          </h2>
          <Link href="/projects" className="button">
            Open studio <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <Logo />
        <p>Real pages. Your direction.</p>
        <Link href="/guide#privacy">Privacy & your keys</Link>
      </footer>
    </>
  );
}
