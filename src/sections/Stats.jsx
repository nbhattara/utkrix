import { stats } from "../data/stats.js";
import PlaceholderNote from "../components/PlaceholderNote.jsx";

export default function Stats() {
  return (
    <section className="section section--tint" aria-label="Company in numbers">
      <div className="container">
        <PlaceholderNote>Placeholder figures. Replace with real numbers.</PlaceholderNote>
        <dl className="stats">
          {stats.map((s) => (
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
