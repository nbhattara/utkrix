import { useEffect, useState } from "react";
import { getApi } from "../api/client.js";
import { stats as fallbackStats } from "../data/stats.js";

export default function Stats() {
  const [items, setItems] = useState(fallbackStats);

  useEffect(() => {
    let active = true;
    getApi("/stats")
      .then((result) => {
        const list = Array.isArray(result) ? result : [];
        if (active && list.length) setItems(list);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <section className="section section--tint" aria-label="Company in numbers">
      <div className="container">
        <dl className="stats">
          {items.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
