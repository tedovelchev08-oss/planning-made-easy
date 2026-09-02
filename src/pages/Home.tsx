import { useEffect } from "react";
import Nav from "../components/marketing/Nav";
import Hero from "../components/marketing/Hero";
import { Features, HowItWorks, Marquee } from "../components/marketing/Sections";
import { Pricing, Stories } from "../components/marketing/Social";
import { FinalCta, Footer } from "../components/marketing/Closing";

export default function Home() {
  useEffect(() => {
    document.title = "Luma — Plan the feeling, not just the wedding";
  }, []);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Pricing />
        <Stories />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
