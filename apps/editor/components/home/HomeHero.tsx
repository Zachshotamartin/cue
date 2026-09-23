import Link from "next/link";

import { ArrowUpRight, ArrowRight } from "@phosphor-icons/react/dist/ssr";
export function HomeHero() {
  return (
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
  );
}
