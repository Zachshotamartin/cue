import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Cue | Your product. In motion.", template: "%s | Cue" },
  description:
    "Turn your website’s real screens into a product film. Capture, direct, generate and make it yours.",
  icons: { icon: "/brand/cue-icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
