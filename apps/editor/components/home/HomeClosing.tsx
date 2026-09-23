import Link from "next/link";

import { Logo } from "../Logo";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
export function HomeClosing() {
  return (
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
  );
}
