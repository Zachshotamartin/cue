import Link from "next/link";
import { Logo } from "./Logo";
export function Nav() {
  return (
    <header className="site-nav">
      <Link href="/" className="brand-link">
        <Logo />
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/guide">How it works</Link>
        <Link href="/brand">Brand</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/projects" className="button small">
          Open studio <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}
