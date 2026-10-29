import { useEffect, useRef, useState } from "react";
import { navItems } from "../config/site.js";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Icon from "./Icon.jsx";

export default function Header({ theme, onToggleTheme, activeId }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  // Close the mobile menu with Escape and return focus to the menu button.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="header">
      <div className="container header__bar">
        <a className="header__brand" href="#home" aria-label="UtkriX Technologies, go to home" onClick={() => setOpen(false)}>
          <Logo />
        </a>

        <nav id="site-nav" className="nav" data-open={open} aria-label="Main">
          <ul>
            {navItems.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} aria-current={activeId === item.id ? "true" : undefined} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header__actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            ref={btnRef}
            type="button"
            className="icon-btn header__menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
