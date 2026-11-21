import { stats } from "../data/stats.js";

export default function Stats() {
  return (
    <section className="section section--tint" aria-label="Company in numbers">
      <div className="container">
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
