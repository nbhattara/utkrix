import { useEffect, useState } from "react";

// Returns the id of the section currently in view (for nav highlighting).
export function useActiveSection(ids, enabled = true) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!enabled) return undefined;
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.1, 0.5, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids, enabled]);
  return active;
}
