import { useEffect, useState } from "react";

// Tiny hash router, no dependency.
//   #/privacy-policy, #/terms-of-service -> legal pages
//   anything else (#home, #about, ...)    -> the single-page home with in-page anchors
const parse = () => {
  const h = window.location.hash;
  if (h.startsWith("#/")) {
    const [page, search = ""] = h.slice(2).split("?");
    return { page, anchor: "", query: new URLSearchParams(search) };
  }
  // Support clean path URLs like /login, /dashboard, /privacy-policy
  // (Vercel serves index.html for all paths; hash routes still take priority).
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (path && !path.includes(".")) {
    const [page, search = ""] = path.split("?");
    return { page, anchor: "", query: new URLSearchParams(search) };
  }
  return { page: "home", anchor: h.slice(1), query: new URLSearchParams() };
};

export function useHashRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
