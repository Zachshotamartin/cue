import { Nav } from "../components/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="landing">
        <HomeHero />
        <HomeIntroduction />
        <HomeWorkflow />
        <HomeClosing />
      </main>
      <SiteFooter />
    </>
  );
}

import { HomeHero } from "../components/home/HomeHero";

import { HomeIntroduction } from "../components/home/HomeIntroduction";

import { HomeWorkflow } from "../components/home/HomeWorkflow";

import { HomeClosing } from "../components/home/HomeClosing";

import { SiteFooter } from "../components/home/SiteFooter";
