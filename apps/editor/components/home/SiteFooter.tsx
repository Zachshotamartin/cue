import Link from "next/link";

import { Logo } from "../Logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Logo />
      <p>Real pages. Your direction.</p>
      <Link href="/guide#privacy">Privacy & your keys</Link>
    </footer>
  );
}
