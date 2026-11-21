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
  if (h) return { page: "home", anchor: h.slice(1), query: new URLSearchParams() };

  const directPage = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const directPages = new Set([
    "login",
    "register",
    "forgot-password",
    "verify-email",
    "password-reset",
    "auth/callback",
    "dashboard",
  ]);
  if (directPages.has(directPage)) {
    return { page: directPage, anchor: "", query: new URLSearchParams(window.location.search) };
  }
  return { page: "home", anchor: "", query: new URLSearchParams() };
};

export function useHashRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);
  return route;
}
