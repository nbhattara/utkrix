import { useCallback, useEffect, useState } from "react";

const KEY = "utkrix-theme";
const systemTheme = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const readSaved = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

// Respects the system preference by default; remembers an explicit choice in localStorage.
export function useTheme() {
  const [theme, setTheme] = useState(() => readSaved() || systemTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Follow system changes until the user makes their own choice.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (!readSaved()) setTheme(systemTheme()); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}
