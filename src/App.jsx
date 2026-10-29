import { useEffect } from "react";
import { navItems } from "./config/site.js";
import { useTheme } from "./hooks/useTheme.js";
import { useHashRoute } from "./hooks/useHashRoute.js";
import { useActiveSection } from "./hooks/useActiveSection.js";
import { privacyPolicy } from "./data/dataNotice.js";
import { termsOfService } from "./data/usageAgreement.js";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import DocumentPage from "./components/DocumentPage.jsx";
import Hero from "./sections/Hero.jsx";
import Services from "./sections/Services.jsx";
import Stats from "./sections/Stats.jsx";
import About from "./sections/About.jsx";
import MissionVision from "./sections/MissionVision.jsx";
import Projects from "./sections/Projects.jsx";
import Contact from "./sections/Contact.jsx";

// Legal pages: route (hash) -> document. Add more here if needed.
const legalDocs = {
  "privacy-policy": privacyPolicy,
  "terms-of-service": termsOfService,
};
const navIds = navItems.map((n) => n.id);

export default function App() {
  const { theme, toggle } = useTheme();
  const { page, anchor } = useHashRoute();
  const isLegal = page in legalDocs;
  const activeId = useActiveSection(navIds, !isLegal);

  // Scroll handling: in-page anchors work natively on the home page; this covers
  // arriving from a legal page (target not yet rendered) and opening a legal page.
  useEffect(() => {
    if (isLegal || !anchor) { window.scrollTo({ top: 0, behavior: "instant" }); return; }
    document.getElementById(anchor)?.scrollIntoView({ behavior: "instant" });
  }, [page, isLegal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => { e.preventDefault(); const m = document.getElementById("main"); m.focus(); m.scrollIntoView(); }}
      >
        Skip to content
      </a>
      <Header theme={theme} onToggleTheme={toggle} activeId={isLegal ? null : activeId} />
      <main id="main" tabIndex={-1}>
        {isLegal ? (
          <DocumentPage doc={legalDocs[page]} slug={page} />
        ) : (
          <>
            <Hero />
            <Services />
            <Stats />
            <About />
            <MissionVision />
            <Projects />
            <Contact />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
