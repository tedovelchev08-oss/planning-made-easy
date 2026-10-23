import { useEffect } from "react";
import Nav from "../components/marketing/Nav";
import { FoldHero, GuestSide, HonestNotes, InvitationShelf } from "../components/marketing/Landing";
import { Pricing, Stories } from "../components/marketing/Social";
import { FinalCta, Footer } from "../components/marketing/Closing";

export default function Home() {
  useEffect(() => {
    document.title = "Twofold — Two of you. One plan.";
  }, []);

  return (
    <div className="tf-land">
      <Nav />
      <main>
        <FoldHero />
        <InvitationShelf />
        <GuestSide />
        <Pricing />
        <Stories />
        <HonestNotes />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
