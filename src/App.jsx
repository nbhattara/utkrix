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
import Courses from "./sections/Courses.jsx";
import Contact from "./sections/Contact.jsx";
import AuthPage from "./components/AuthPage.jsx";
import SupportMessenger from "./components/SupportMessenger.jsx";

const LOGIN_URL = (import.meta.env.VITE_LOGIN_URL || "http://login.lvh.me:5173").replace(/\/+$/, "");
const EMPLOYEES_URL = (import.meta.env.VITE_EMPLOYEES_URL || "http://employees.lvh.me:5173").replace(/\/+$/, "");

const AUTH_ROUTE_MAP = {
  login: "/login",
  register: "/register",
  "forgot-password": "/forgot-password",
  "verify-email": "/verify-email",
  "password-reset": "/reset-password",
};

function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

// Legal pages: route (hash) -> document. Add more here if needed.
const legalDocs = {
  "privacy-policy": privacyPolicy,
  "terms-of-service": termsOfService,
};
const navIds = navItems.map((n) => n.id);

export default function App() {
  const { theme, toggle } = useTheme();
  const { page, anchor, query } = useHashRoute();

  // The login.* subdomain should open the sign-in page, not the landing page.
  useEffect(() => {
    if (window.location.hostname.startsWith("login.")
      && window.location.pathname === "/"
      && !window.location.hash.startsWith("#/")) {
      window.location.replace("/login");
    }
  }, []);
  const isLegal = page in legalDocs;
  const isDashboard = page === "dashboard";
  const isAuthCallback = page === "auth/callback";
  const isAuthRedirect = page in AUTH_ROUTE_MAP;
  const isAuth = isAuthRedirect || isAuthCallback;
  const authRedirectTo = isAuthRedirect
    ? `${LOGIN_URL}${AUTH_ROUTE_MAP[page]}${window.location.hash.includes("?") ? window.location.hash.slice(window.location.hash.indexOf("?")) : ""}`
    : null;
  const activeId = useActiveSection(navIds, !isLegal && !isAuth && !isDashboard);

  // Scroll handling: in-page anchors work natively on the home page; this covers
  // arriving from a legal page (target not yet rendered) and opening a legal page.
  useEffect(() => {
    if (isLegal || isDashboard || !anchor) { window.scrollTo({ top: 0, behavior: "instant" }); return; }
    document.getElementById(anchor)?.scrollIntoView({ behavior: "instant" });
  }, [page, isLegal, isDashboard]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {isDashboard ? (
          <ExternalRedirect to={EMPLOYEES_URL} />
        ) : isAuthRedirect || isAuthCallback ? (
          <AuthPage page={page} query={query} />
        ) : isLegal ? (
          <DocumentPage doc={legalDocs[page]} slug={page} />
        ) : (
          <>
            <Hero />
            <Services />
            <Stats />
            <About />
            <MissionVision />
            <Courses />
            <Projects />
            <Contact />
          </>
        )}
      </main>
      <Footer />
      {!isLegal && !isDashboard && !isAuth && <SupportMessenger />}
    </>
  );
}
