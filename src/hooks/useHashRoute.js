import { useEffect, useState } from "react";

// Tiny hash router, no dependency.
//   #/privacy-policy, #/terms-of-service -> legal pages
//   anything else (#home, #about, ...)    -> the single-page home with in-page anchors
const parse = () => {
  const h = window.location.hash;
  if (!h.startsWith("#/")) return { page: "home", anchor: h.slice(1), query: new URLSearchParams() };
  const [page, search = ""] = h.slice(2).split("?");
  return { page, anchor: "", query: new URLSearchParams(search) };
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
