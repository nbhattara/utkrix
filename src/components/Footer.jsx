import { company, legalPages, navItems } from "../config/site.js";
import Logo from "./Logo.jsx";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo />
          <p>{company.tagline}.</p>
        </div>

        <nav aria-label="Footer: sections">
          <h2 className="footer__title">Explore</h2>
          <ul>
            {navItems.map((n) => (
              <li key={n.id}><a href={`#${n.id}`}>{n.label}</a></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer: legal">
          <h2 className="footer__title">Legal</h2>
          <ul>
            {legalPages.map((p) => (
              <li key={p.route}><a href={`#/${p.route}`}>{p.label}</a></li>
            ))}
          </ul>
        </nav>

        <address className="footer__contact">
          <h2 className="footer__title">Contact</h2>
          <ul>
            <li>{company.address}</li>
            <li><a href={`mailto:${company.email}`}>{company.email}</a></li>
            <li><a href={`tel:${company.phone}`}>{company.phone}</a></li>
          </ul>
        </address>
      </div>
      <div className="container footer__legal">
        <p>© {new Date().getFullYear()} {company.name}, operated by {company.legalEntity}.</p>
      </div>
    </footer>
  );
}
