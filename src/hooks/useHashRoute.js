import { useEffect, useState } from "react";

// Tiny hash router, no dependency.
//   #/privacy-policy, #/terms-of-service -> legal pages
//   anything else (#home, #about, ...)    -> the single-page home with in-page anchors
const parse = () => {
  const h = window.location.hash;
  return h.startsWith("#/") ? { page: h.slice(2), anchor: "" } : { page: "home", anchor: h.slice(1) };
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
