"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { Logo } from "./Logo";
import { Button } from "./ui/Button";

const links = [
  { href: "/guide", label: "How it works" },
  { href: "/brand", label: "Brand" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header
      className={`site-nav${open ? " menu-open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Link href="/" className="brand-link">
        <Logo />
      </Link>
      <Button
        className="icon-button nav-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <List size={22} />}
      </Button>
      <nav id="main-navigation" aria-label="Main navigation">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
        <Link
          href="/projects"
          className="button small"
          onClick={() => setOpen(false)}
        >
          Open studio <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}
